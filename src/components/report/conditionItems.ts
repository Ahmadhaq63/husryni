import type { ConditionItemState, ConditionMapItem, ConditionMapProps } from "@/components/three";
import { getTemplate } from "@/lib/checklist";
import type { Dict } from "@/lib/i18n";
import { GRADE_INFO } from "@/lib/labels";
import { activeFindings, worstGrade } from "@/lib/report";
import type { Finding, InspectionItem, Lang } from "@/lib/types";

/** Map an item's capture status to the condition-map state. "Not accessible" counts as skipped. */
export function itemState(item: InspectionItem): ConditionItemState {
  if (item.status === "skipped" || item.notAccessible) return "skipped";
  if (item.status === "analyzed") return "analyzed";
  return "pending";
}

/**
 * One condition-map entry per checklist item, in the order given (the report's order).
 * The grade is the worst grade among the item's active findings (inspector-rejected ones excluded,
 * ranked by GRADE_INFO severity), or null when it has none.
 */
export function conditionMapItems(items: InspectionItem[], findings: Finding[], lang: Lang): ConditionMapItem[] {
  const active = activeFindings(findings);
  return items.map((item) => {
    const mine = active.filter((f) => f.itemKey === item.itemKey);
    return {
      key: item.itemKey,
      title: getTemplate(item.itemKey)?.title[lang] ?? item.itemKey,
      grade: worstGrade(mine),
      state: itemState(item),
      // What the drone view shows for this part of the house: its most serious findings.
      findings: mine
        .filter((f) => f.grade !== "TG0")
        .sort((a, b) => GRADE_INFO[b.grade].severity - GRADE_INFO[a.grade].severity)
        .slice(0, 3)
        .map((f) => ({ title: f.title, grade: f.grade })),
    };
  });
}

/** Translated legend for the condition map (grades from GRADE_INFO, plus the item states). */
export function conditionLegend(t: Dict, lang: Lang): ConditionMapProps["legend"] {
  return {
    TG0: GRADE_INFO.TG0.label[lang],
    TG1: GRADE_INFO.TG1.label[lang],
    TG2: GRADE_INFO.TG2.label[lang],
    TG3: GRADE_INFO.TG3.label[lang],
    TGIU: GRADE_INFO.TGIU.label[lang],
    ok: t.rpLegendOk,
    skipped: t.rpLegendSkipped,
    pending: t.rpLegendPending,
  };
}
