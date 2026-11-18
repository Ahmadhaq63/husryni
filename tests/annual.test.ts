import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANNUAL_QUESTIONS, annualMissing, annualTotals, isContradicted, isResolved, nextDue } from "@/lib/annual";
import { ITEM_TEMPLATES } from "@/lib/checklist";
import type { FollowUpRecord, FollowUpVerdict } from "@/lib/types";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "husryni-annual-"));
process.env.DATA_DIR = dir;
process.env.AI_MODE = "mock";
const repo = await import("@/lib/repo");
const annual = await import("@/lib/annualRepo");
const { checkFollowUp } = await import("@/lib/ai");
const { savePhotoFile } = await import("@/lib/storage");

const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);
const verdict = (v: FollowUpVerdict["verdict"]): FollowUpVerdict => ({ engine: "mock", model: "demo", verdict: v, explanation: "", retakeRequests: [], checkedAt: "" });
const fu = (answer: FollowUpRecord["answer"], v?: FollowUpVerdict["verdict"]) => ({ answer, verdict: v ? verdict(v) : null });

describe("yearly check rules", () => {
  it("closes 'fixed' unless the photos disagree", () => {
    expect(isResolved(fu("fixed"))).toBe(true);
    expect(isResolved(fu("fixed", "fixed"))).toBe(true);
    expect(isResolved(fu("fixed", "cannot_tell"))).toBe(true);
    expect(isResolved(fu("fixed", "unchanged"))).toBe(false);
    expect(isResolved(fu("fixed", "partially_fixed"))).toBe(false);
    expect(isResolved(fu("unchanged", "fixed"))).toBe(false);
  });
  it("flags answers the photos contradict", () => {
    expect(isContradicted(fu("fixed", "worse"))).toBe(true);
    expect(isContradicted(fu("unchanged", "fixed"))).toBe(true);
    expect(isContradicted(fu("worse", "worse"))).toBe(false);
    expect(isContradicted(fu("fixed", "cannot_tell"))).toBe(false);
    expect(isContradicted(fu("fixed"))).toBe(false);
  });
  it("every question points at a checklist item", () => {
    const keys = new Set(ITEM_TEMPLATES.map((t) => t.key));
    for (const q of ANNUAL_QUESTIONS) expect(keys.has(q.itemKey), q.id).toBe(true);
    expect(ANNUAL_QUESTIONS).toHaveLength(10);
  });
  it("is due a year after the last confirmation", () => {
    expect(nextDue("2026-01-15T10:00:00.000Z")).toBe("2027-01-15T10:00:00.000Z");
  });
});

let reportId = "";
beforeAll(async () => {
  reportId = repo.createInspection({
    tier: "basic",
    purpose: "owner",
    lang: "en",
    address: "Prufugata 2",
    postalCode: "101",
    fastanumer: "F2000001",
    heinum: 123456,
    contactName: "Test",
    contactEmail: "test@example.com",
    propertyType: "einbyli",
    buildYear: 1990,
    sizeM2: 150,
    construction: "steypa",
    heating: "hitaveita",
    hasBasement: false,
    hasAttic: false,
    priceIsk: null,
  });
  const pid = repo.newId(12);
  await savePhotoFile(reportId, pid, "image/jpeg", JPEG);
  repo.addPhoto({ id: pid, inspectionId: reportId, itemKey: "bathroom", source: "camera", mime: "image/jpeg", sizeBytes: JPEG.length });
  const base = { description: "d", cause: "c", consequence: "q", confidence: "high" as const, photoIds: [pid], recommendedAction: "", followUp: "none" as const, costKey: "none" };
  repo.saveItemAnalysis(reportId, "bathroom", { engine: "mock", model: "demo", analyzedAt: "", sufficient: true, retakeRequests: [], privacyFlags: [], itemSummary: "" }, [
    { ...base, title: "Cracked grout", grade: "TG2", urgency: "within_1y" },
    { ...base, title: "Worn sealant", grade: "TG1", urgency: "within_5y" },
    { ...base, title: "Looks fine", grade: "TG0", urgency: "monitor" },
  ]);
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("yearly check flow", () => {
  it("only starts once the report is final", () => {
    expect(annual.startAnnualCheck(reportId)).toBeNull();
    repo.setStatus(reportId, "ai_report");
  });

  it("follows up the open TG1–TG3 findings, carries problems over and closes fixed ones", async () => {
    const a1 = annual.startAnnualCheck(reportId)!;
    expect(annual.startAnnualCheck(reportId)).toBe(a1); // resumes the open one
    const check = repo.getInspection(a1)!;
    expect(check).toMatchObject({ kind: "annual", parentId: reportId, status: "capturing", fastanumer: "F2000001", heinum: 123456 });
    expect(repo.listInspections().map((i) => i.id)).not.toContain(a1); // not in the inspector queue

    const fus = annual.getFollowUps(a1);
    expect(fus.map((f) => repo.getFinding(f.findingId)!.title)).toEqual(["Cracked grout", "Worn sealant"]);
    const [grout, sealant] = fus;

    // Two AFTER photos + answer → the demo comparison follows the answer.
    for (let i = 0; i < 2; i++) {
      const pid = repo.newId(12);
      await savePhotoFile(a1, pid, "image/jpeg", JPEG);
      repo.addPhoto({ id: pid, inspectionId: a1, itemKey: `fu:${grout.findingId}`, source: "camera", mime: "image/jpeg", sizeBytes: JPEG.length });
    }
    annual.setFollowUp(a1, grout.findingId, { answer: "fixed", note: "Regrouted in May" });
    expect((await checkFollowUp(a1, grout.findingId)).verdict).toBe("fixed");
    // New or deleted photos make the comparison stale: it is cleared.
    annual.photosChanged(a1, `fu:${grout.findingId}`);
    expect(annual.getFollowUp(a1, grout.findingId)!.verdict).toBeNull();
    expect((await checkFollowUp(a1, grout.findingId)).verdict).toBe("fixed");
    annual.setFollowUp(a1, sealant.findingId, { answer: "worse" });

    expect(annual.submitAnnualCheck(a1)).toEqual({ ok: false, missing: { followUps: [], questions: ANNUAL_QUESTIONS.map((q) => q.id) } });
    for (const q of ANNUAL_QUESTIONS) annual.setAnswer(a1, q.id, { answer: q.problemAnswer === "yes" ? "no" : "yes" });
    annual.setAnswer(a1, "damp", { answer: "yes", note: "Black spots above the shower" });
    annual.setAnswer(a1, "smoke_alarm", { answer: "unknown" });
    expect(annual.submitAnnualCheck(a1)).toEqual({ ok: true });
    expect(annual.setFollowUp(a1, grout.findingId, { answer: "unchanged" })).toBeNull(); // locked once submitted
    // A photo comparison finishing after submission must not change the completed check.
    expect(annual.setFollowUpVerdict(a1, grout.findingId, null)).toBe(false);
    expect(annual.getFollowUp(a1, grout.findingId)!.verdict?.verdict).toBe("fixed");
    await expect(checkFollowUp(a1, grout.findingId)).rejects.toThrow();

    const done = repo.getInspection(a1)!;
    expect(done.status).toBe("ai_report");
    expect(done.completedAt).toBeTruthy();
    const totals = annualTotals(annual.getFollowUps(a1), annual.getAnswers(a1));
    expect(totals).toMatchObject({ fixed: 1, worse: 1, problems: 1, unsure: 1, questionsAnswered: 10 });
    const problem = repo.getBundle(a1)!.findings.find((f) => f.source === "owner")!;
    expect(problem).toMatchObject({ itemKey: "bathroom", grade: "TG2", description: "Black spots above the shower" });

    // Open now: the worse sealant and the new damp problem; the fixed grout is closed.
    expect(annual.openFindings(reportId).map((f) => f.title).sort()).toEqual(["Damp or mould in a wet room (reported by the owner)", "Worn sealant"]);
    expect(annual.lastConfirmed(repo.getInspection(reportId)!)).toBe(done.completedAt);

    // The next check follows up exactly those.
    const a2 = annual.startAnnualCheck(reportId)!;
    expect(a2).not.toBe(a1);
    expect(annual.getFollowUps(a2)).toHaveLength(2);
    expect(annualMissing(annual.getFollowUps(a2), annual.getAnswers(a2)).followUps).toHaveLength(2);
  });

  it("numbers repair quotes uniquely, also after a draft is deleted", async () => {
    const owner = await import("@/lib/ownerRepo");
    const [grout, sealant] = repo.getBundle(reportId)!.findings.filter((f) => f.grade !== "TG0");
    const [q1] = owner.createQuoteDrafts(reportId, [grout.id], "en");
    const [q2] = owner.createQuoteDrafts(reportId, [sealant.id], "en");
    expect([q1.number.slice(-3), q2.number.slice(-3)]).toEqual(["001", "002"]);
    expect(owner.createQuoteDrafts(reportId, [grout.id], "en")).toEqual([]); // already in a quote
    expect(owner.deleteQuote(reportId, q1.id)).toBe(true);
    const [q3] = owner.createQuoteDrafts(reportId, [grout.id], "en");
    expect(q3.number.slice(-3)).toBe("003");
    expect(owner.updateQuote(reportId, q3.id, { status: "approved" })!.status).toBe("approved");
    expect(owner.updateQuote(reportId, q3.id, { status: "draft" })).toBeNull(); // approved is locked
    expect(owner.deleteQuote(reportId, q3.id)).toBe(false);
  });

  it("finds other reports of the same property", () => {
    const other = repo.createInspection({ ...repo.getInspection(reportId)!, fastanumer: null, heinum: 123456, constructionStage: null });
    const rel = repo.relatedReports(repo.getInspection(other)!);
    expect(rel.map((r) => [r.inspection.id, r.match])).toEqual([[reportId, "address"]]);
  });
});
