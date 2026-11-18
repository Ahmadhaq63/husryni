import { getTemplate, riskNotes } from "../checklist";
import { getCost } from "../costs";
import { getBundle, getInspection, getItem, getPhoto, listItemPhotos, saveItemAnalysis, saveSummary, setPhotoCheck, type NewFinding } from "../repo";
import { readPhotoFile } from "../storage";
import type { InspectionSummaryAI, ItemAnalysisRecord } from "../types";
import { AiError, claudeAnalyzeItem, claudeCheckPhoto, claudeModel, claudeSummarize, claudeVerifyFix, type ImageInput } from "./claude";
import { mockAnalyzeItem, mockSummarize, mockVerifyFix } from "./mock";
import { fixTaskText, itemTaskText, photoCheckText, summaryTaskText } from "./prompt";
import type { FixCheck, ItemAnalysis } from "./schema";
import { fixItemKey, getRemedy, setFixStatus } from "../negotiationRepo";
import type { FixVerdict, Photo } from "../types";

export { AiError } from "./claude";

export type Engine = "claude" | "mock";

/** auto: use Claude when credentials are present in the environment, otherwise the demo analyser. */
export function aiEngine(): Engine {
  const mode = (process.env.AI_MODE ?? "auto").toLowerCase();
  if (mode === "claude") return "claude";
  if (mode === "mock") return "mock";
  return process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE ? "claude" : "mock";
}

/** Map the model's photo numbers / cost keys onto our records, dropping anything invalid. */
export function toNewFindings(analysis: ItemAnalysis, photoIds: string[]): NewFinding[] {
  return analysis.findings.map((f) => ({
    title: f.title.trim(),
    description: f.description.trim(),
    grade: f.grade,
    confidence: f.confidence,
    photoIds: [...new Set(f.photo_numbers)]
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= photoIds.length)
      .map((n) => photoIds[n - 1]),
    recommendedAction: f.recommended_action.trim(),
    followUp: f.follow_up,
    urgency: f.urgency,
    costKey: getCost(f.cost_key) ? f.cost_key : "none",
  }));
}

export async function analyzeInspectionItem(inspectionId: string, itemKey: string) {
  const bundle = getBundle(inspectionId);
  const item = getItem(inspectionId, itemKey);
  const template = getTemplate(itemKey);
  if (!bundle || !item || !template) throw new Error("not found");
  const photos = listItemPhotos(inspectionId, itemKey);
  if (photos.length === 0) {
    throw new AiError("no photos", { is: "Taktu að minnsta kosti eina mynd fyrst.", en: "Take at least one photo first." });
  }

  const engine = aiEngine();
  let analysis: ItemAnalysis;
  let model = "demo";
  let usage: ItemAnalysisRecord["usage"];

  if (engine === "claude") {
    const images: ImageInput[] = await Promise.all(
      photos.map(async (p) => ({
        mime: p.mime as ImageInput["mime"],
        base64: (await readPhotoFile(inspectionId, p.id, p.mime)).toString("base64"),
      })),
    );
    const task = itemTaskText({
      inspection: bundle.inspection,
      template,
      item,
      photoCount: photos.length,
      notes: riskNotes(bundle.inspection),
    });
    const result = await claudeAnalyzeItem(images, task);
    analysis = result.output;
    model = result.model;
    usage = result.usage;
  } else {
    analysis = mockAnalyzeItem(template, photos.length, bundle.inspection.lang);
  }

  const record: ItemAnalysisRecord = {
    engine,
    model,
    analyzedAt: new Date().toISOString(),
    sufficient: analysis.photos_sufficient,
    retakeRequests: analysis.retake_requests.map((r) => ({ photoNumber: r.photo_number, reason: r.reason })),
    privacyFlags: analysis.privacy_flags.map((p) => ({ photoNumber: p.photo_number, issue: p.issue })),
    itemSummary: analysis.item_summary,
    usage,
  };
  saveItemAnalysis(
    inspectionId,
    itemKey,
    record,
    toNewFindings(
      analysis,
      photos.map((p) => p.id),
    ),
  );
  return record;
}

/** Summary over the current (non-rejected) findings. Falls back to the demo text if Claude fails. */
export async function generateSummary(inspectionId: string): Promise<InspectionSummaryAI> {
  const bundle = getBundle(inspectionId);
  if (!bundle) throw new Error("not found");
  const { inspection, items } = bundle;
  const findings = bundle.findings.filter((f) => f.reviewStatus !== "rejected");
  const title = (key: string) => getTemplate(key)?.title[inspection.lang] ?? key;
  const notAssessed = items.filter((i) => i.status === "skipped").map((i) => title(i.itemKey));
  const counts = {
    total: findings.length,
    tg2: findings.filter((f) => f.grade === "TG2").length,
    tg3: findings.filter((f) => f.grade === "TG3").length,
  };

  let summary: InspectionSummaryAI;
  if (aiEngine() === "claude") {
    const r = await claudeSummarize(summaryTaskText({ inspection, findings, itemTitle: title, notAssessed }));
    summary = { engine: "claude", overall: r.output.overall, keyRisks: r.output.key_risks, advice: r.output.advice, generatedAt: new Date().toISOString() };
  } else {
    const m = mockSummarize(inspection.lang, counts);
    summary = { engine: "mock", overall: m.overall, keyRisks: m.key_risks, advice: m.advice, generatedAt: new Date().toISOString() };
  }
  saveSummary(inspectionId, summary);
  return summary;
}

/**
 * Compare the inspection's BEFORE photos of a finding with the seller's AFTER photos
 * (Nestic's "I have fixed this area → analyse again" loop, applied to repairs before handover).
 */
export async function verifyFix(inspectionId: string, findingId: string): Promise<FixVerdict> {
  const bundle = getBundle(inspectionId);
  const finding = bundle?.findings.find((f) => f.id === findingId);
  const remedy = getRemedy(findingId);
  if (!bundle || !finding || !remedy) throw new Error("not found");
  if (remedy.action !== "seller_fix") {
    throw new AiError("not a repair item", { is: "Þetta atriði er ekki lagfæring seljanda.", en: "This item is not a seller repair." });
  }
  const after = listItemPhotos(inspectionId, fixItemKey(findingId));
  if (after.length === 0) {
    throw new AiError("no after photos", { is: "Sendu fyrst mynd eftir lagfæringu.", en: "Upload a photo after the repair first." });
  }
  // BEFORE: the photos the finding points at, or the whole item's photos when it points at none.
  const itemPhotos = listItemPhotos(inspectionId, finding.itemKey);
  const before: Photo[] = finding.photoIds.length ? itemPhotos.filter((p) => finding.photoIds.includes(p.id)) : itemPhotos;

  const engine = aiEngine();
  let check: FixCheck;
  let model = "demo";
  if (engine === "claude") {
    const load = async (p: Photo): Promise<ImageInput> => ({
      mime: p.mime as ImageInput["mime"],
      base64: (await readPhotoFile(inspectionId, p.id, p.mime)).toString("base64"),
    });
    const task = fixTaskText({
      inspection: bundle.inspection,
      finding,
      itemTitle: getTemplate(finding.itemKey)?.title.en ?? finding.itemKey,
      beforeCount: before.length,
      afterCount: after.length,
      sellerComment: remedy.sellerComment,
    });
    const r = await claudeVerifyFix(await Promise.all(before.map(load)), await Promise.all(after.map(load)), task);
    check = r.output;
    model = r.model;
  } else {
    check = mockVerifyFix(bundle.inspection.lang, after.length);
  }

  // A verdict for a different spot is no verdict.
  const verdictValue = check.same_location === "no" ? "cannot_tell" : check.verdict;
  const verdict: FixVerdict = {
    engine,
    model,
    verdict: verdictValue,
    explanation: check.explanation,
    remainingIssues: check.remaining_issues,
    retakeRequests: check.retake_requests.map((r) => ({ photoNumber: r.photo_number, reason: r.reason })),
    checkedAt: new Date().toISOString(),
  };
  setFixStatus(findingId, verdictValue, verdict);
  return verdict;
}

/**
 * Fast usability check right after upload (cheap model). Best effort: any failure leaves
 * the photo "unchecked" and never blocks the user. Demo mode skips the check.
 */
export async function checkPhoto(photoId: string): Promise<{ status: Photo["checkStatus"]; reason: string | null }> {
  const photo = getPhoto(photoId);
  const inspection = photo ? getInspection(photo.inspectionId) : null;
  const template = photo ? getTemplate(photo.itemKey) : undefined;
  if (!photo || !inspection || !template || aiEngine() !== "claude") return { status: "unchecked", reason: null };
  try {
    const data = await readPhotoFile(photo.inspectionId, photo.id, photo.mime);
    const r = await claudeCheckPhoto(
      { mime: photo.mime as ImageInput["mime"], base64: data.toString("base64") },
      photoCheckText({ template }),
    );
    if (!r) return { status: "unchecked", reason: null };
    const status = r.output.usable ? "ok" : "retake";
    // Stored as an issue code; the UI shows fixed, reviewed advice in the viewer's language.
    const reason = r.output.usable ? null : r.output.issue === "ok" ? "other" : r.output.issue;
    setPhotoCheck(photo.id, status, reason);
    return { status, reason };
  } catch (err) {
    console.error(`[photo-check] ${photoId}`, err instanceof Error ? err.message : err);
    return { status: "unchecked", reason: null };
  }
}

export { claudeModel };
