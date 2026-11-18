/**
 * How a checklist item looks on the condition map and in its list. Pure (no three.js).
 */
import { GRADE_COLOR, STATE_COLOR } from "@/lib/gradeColors";
import { GRADES, type Grade } from "@/lib/types";
import type { ConditionMapItem } from "./index";

export type Tone = Grade | "ok" | "skipped" | "pending";

/** Legend order: the grade scale, then the states without a grade. */
export const TONES: Tone[] = [...GRADES, "ok", "skipped", "pending"];

export function toneOf(item: Pick<ConditionMapItem, "grade" | "state">): Tone {
  if (item.grade) return item.grade;
  return item.state === "analyzed" ? "ok" : item.state;
}

export function toneColor(tone: Tone): string {
  return tone === "ok" || tone === "skipped" || tone === "pending" ? STATE_COLOR[tone] : GRADE_COLOR[tone].solid;
}

/** Higher = more serious. Drives pin size, stacking and list order. */
export const TONE_RANK: Record<Tone, number> = {
  TG3: 7,
  TG2: 6,
  TG1: 5,
  TGIU: 4,
  TG0: 3,
  ok: 2,
  skipped: 1,
  pending: 0,
};

/** Pin diameter in CSS pixels: worse grades are bigger. */
export const TONE_SIZE: Record<Tone, number> = {
  TG3: 32,
  TG2: 28,
  TG1: 24,
  TGIU: 22,
  TG0: 22,
  ok: 22,
  skipped: 18,
  pending: 18,
};

/** Short glyph inside a pin: the TG digit, or an icon for states without a grade. */
export const TONE_GLYPH: Record<Tone, { text?: string; icon?: string }> = {
  TG0: { text: "0" },
  TG1: { text: "1" },
  TG2: { text: "2" },
  TG3: { text: "3" },
  TGIU: { text: "?" },
  ok: { icon: "bi-check-lg" },
  skipped: { icon: "bi-dash-lg" },
  pending: { icon: "bi-three-dots" },
};

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const INK = "#0a1714";

/** White or near-black, whichever reads better on the given colour (WCAG contrast). */
export function readableOn(hex: string): string {
  const l = luminance(hex);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / (luminance(INK) + 0.05);
  return onWhite >= onInk ? "#ffffff" : INK;
}
