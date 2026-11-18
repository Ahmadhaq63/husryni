import type { Grade } from "./types";

/**
 * One grade palette for badges, report bars and the 3D condition map, following the Nordic
 * TG convention (green → yellow → orange → red). CSS mirrors these as --grade-* in theme.css.
 */
export const GRADE_COLOR: Record<Grade, { solid: string; soft: string; text: string }> = {
  TG0: { solid: "#1f9d55", soft: "#e6f4ec", text: "#136c3a" },
  TG1: { solid: "#d4a20c", soft: "#fbf3d9", text: "#6f5300" },
  TG2: { solid: "#e46f12", soft: "#fdeadb", text: "#8f3f05" },
  TG3: { solid: "#d1352b", soft: "#fbe4e2", text: "#9b231c" },
  TGIU: { solid: "#7b8794", soft: "#eef1f4", text: "#46515c" },
};

/** Checklist items without a graded finding. */
export const STATE_COLOR = {
  /** Analysed, nothing found: shown like TG0. */
  ok: GRADE_COLOR.TG0.solid,
  /** Marked "not accessible / not applicable". */
  skipped: "#a9b4be",
  /** Not analysed yet. */
  pending: "#d5dde3",
} as const;
