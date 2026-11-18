import { baselineRecommendations, getTemplate, type ItemTemplate } from "./checklist";
import { getCost } from "./costs";
import { GRADE_INFO } from "./labels";
import { notAssessedItem, overallGrade, overallItemOf, systemStatuses, type OverallResult, type SystemStatus } from "./standard";
import type { Finding, FollowUp, Grade, InspectionBundle, InspectionItem, L10n } from "./types";
import { GRADES } from "./types";

export const bySeverityDesc = (a: Finding, b: Finding) => GRADE_INFO[b.grade].severity - GRADE_INFO[a.grade].severity;

/** Findings that count in the report: inspector-rejected ones are dropped. */
export const activeFindings = (findings: Finding[]) => findings.filter((f) => f.reviewStatus !== "rejected");

export function worstGrade(findings: Finding[]): Grade | null {
  let worst: Grade | null = null;
  for (const f of findings) {
    if (worst === null || GRADE_INFO[f.grade].severity > GRADE_INFO[worst].severity) worst = f.grade;
  }
  return worst;
}

export interface ItemSection {
  template: ItemTemplate;
  item: InspectionItem;
  findings: Finding[];
  worst: Grade | null;
  photoIds: string[];
}

export interface FollowUpEntry {
  followUp: FollowUp;
  itemKeys: string[];
  baselineReason: L10n | null;
}

export interface CostLine {
  findingId: string;
  itemKey: string;
  title: string;
  costKey: string;
  minIsk: number;
  maxIsk: number;
}

export interface ReportModel {
  sections: ItemSection[];
  counts: Record<Grade, number>;
  worst: Grade | null;
  followUps: FollowUpEntry[];
  costLines: CostLine[];
  costMin: number;
  costMax: number;
  completeness: { required: number; done: number; skipped: number; pending: number; percent: number };
  usedMock: boolean;
  /** Overall grade by the published rule (src/lib/standard.ts), computed from the current findings. */
  overall: OverallResult;
  /** The ten building systems with a traffic light each. */
  systems: SystemStatus[];
}

export function isRequired(template: ItemTemplate | undefined) {
  return !!template && template.minPhotos > 0;
}

export function buildReport(bundle: InspectionBundle): ReportModel {
  const findings = activeFindings(bundle.findings);
  const sections: ItemSection[] = [];
  for (const item of bundle.items) {
    const template = getTemplate(item.itemKey);
    if (!template) continue;
    const f = findings.filter((x) => x.itemKey === item.itemKey).sort(bySeverityDesc);
    sections.push({
      template,
      item,
      findings: f,
      worst: worstGrade(f),
      photoIds: bundle.photos.filter((p) => p.itemKey === item.itemKey).map((p) => p.id),
    });
  }

  const counts = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<Grade, number>;
  for (const f of findings) counts[f.grade]++;

  // Follow-ups from findings, plus age-based baseline recommendations.
  const fu = new Map<FollowUp, FollowUpEntry>();
  for (const f of findings) {
    if (f.followUp === "none" || f.grade === "TG0") continue;
    const e = fu.get(f.followUp) ?? { followUp: f.followUp, itemKeys: [], baselineReason: null };
    if (!e.itemKeys.includes(f.itemKey)) e.itemKeys.push(f.itemKey);
    fu.set(f.followUp, e);
  }
  for (const r of baselineRecommendations(bundle.inspection)) {
    const e = fu.get(r.followUp) ?? { followUp: r.followUp, itemKeys: [], baselineReason: null };
    e.baselineReason = r.reason;
    fu.set(r.followUp, e);
  }

  const costLines: CostLine[] = [];
  for (const f of findings) {
    if (f.grade === "TG0" || f.grade === "TGIU") continue;
    const c = getCost(f.costKey);
    if (!c) continue;
    costLines.push({ findingId: f.id, itemKey: f.itemKey, title: f.title, costKey: f.costKey, minIsk: c.minIsk, maxIsk: c.maxIsk });
  }

  const required = sections.filter((s) => isRequired(s.template));
  const done = required.filter((s) => s.item.status === "analyzed").length;
  const skipped = required.filter((s) => s.item.status === "skipped").length;
  const pending = required.length - done - skipped;

  return {
    sections,
    counts,
    worst: worstGrade(findings),
    followUps: [...fu.values()],
    costLines,
    costMin: costLines.reduce((s, l) => s + l.minIsk, 0),
    costMax: costLines.reduce((s, l) => s + l.maxIsk, 0),
    completeness: {
      required: required.length,
      done,
      skipped,
      pending,
      percent: required.length ? Math.round(((done + skipped) / required.length) * 100) : 100,
    },
    usedMock: bundle.items.some((i) => i.analysis?.engine === "mock"),
    overall: overallGrade(sections.map((s) => overallItemOf(s.item.itemKey, s.item.status === "skipped", s.findings))),
    systems: systemStatuses(
      sections.map((s) => ({
        itemKey: s.item.itemKey,
        skipped: notAssessedItem(s.item.status === "skipped", s.findings),
        analyzed: s.item.status === "analyzed",
        worst: s.worst,
        findingTitles: s.findings.filter((f) => f.grade === "TG2" || f.grade === "TG3").map((f) => f.title),
      })),
    ),
  };
}

/**
 * Every required item must be analysed, or marked not accessible with a reason, before submitting.
 * `missing` lists both kinds; `missingReason` only the items that still need a reason.
 */
export function readyToSubmit(bundle: InspectionBundle): { ok: boolean; missing: string[]; missingReason: string[] } {
  const required = bundle.items.filter((i) => isRequired(getTemplate(i.itemKey)));
  const missingReason = required.filter((i) => i.status === "skipped" && !i.naReason.trim()).map((i) => i.itemKey);
  const missing = required.filter((i) => i.status === "pending").map((i) => i.itemKey);
  return { ok: missing.length === 0 && missingReason.length === 0, missing: [...missing, ...missingReason], missingReason };
}
