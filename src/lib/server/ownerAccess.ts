import "server-only";
import { historyOpen } from "../annualRepo";
import { getInspection } from "../repo";
import type { Inspection } from "../types";

/**
 * Owner tools (sharing, quotes, problems, the assistant) work on a final full report. The inspection link is
 * the owner's key; a yearly check's link leads to its report.
 */
export function finalReport(id: string): Inspection | null {
  const i = getInspection(id);
  if (!i) return null;
  const root = i.kind === "annual" && i.parentId ? getInspection(i.parentId) : i;
  return root && historyOpen(root) ? root : null;
}

export const NOT_FINAL = { is: "Þetta er í boði þegar skýrslan er tilbúin.", en: "This is available once the report is final." };
