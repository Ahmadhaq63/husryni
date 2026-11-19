import { GRADE_INFO } from "./labels";
import type { Finding, Grade, L10n, Lang } from "./types";

/**
 * The report standard: the rules every Húsrýni report follows, kept in one place so the report,
 * the inspector screens, the seal and the tests all use the same definitions. The version is
 * stamped on every signed report, so a later change to a rule never silently changes an old report.
 *
 * Built on the Nordic model (NS 3600 condition grades): cause and consequence for TG2/TG3,
 * a published rule for the overall grade, moisture readings as data, ten building systems that
 * make reports comparable across properties, and an independence declaration at signing.
 * No pure-function here touches the database or the file system (client components import it).
 */

export const STANDARD_VERSION = "1.0";
export const STANDARD_NAME: L10n = { is: "Húsrýnisstaðall", en: "Húsrýni standard" };
export const standardLabel = (lang: Lang, version: string = STANDARD_VERSION) => `${STANDARD_NAME[lang]} ${version}`;

// ---------------------------------------------------------------- overall grade

export type OverallGrade = "TG0" | "TG1" | "TG2" | "TG3";

/** The published rule, word for word as shown in the report. */
export const OVERALL_RULE: L10n = {
  is: "TG3 ef liður er TG3 og krefst bráðrar aðgerðar, eða tveir eða fleiri liðir eru TG3 · TG2 ef einn liður er TG3 eða þrír eða fleiri liðir eru TG2 · TG1 ef önnur frávik eru skráð · annars TG0. Liðir sem ekki voru metnir telja ekki með en eru taldir upp í skýrslunni.",
  en: "TG3 if an item is TG3 and needs immediate action, or two or more items are TG3 · TG2 if one item is TG3 or three or more items are TG2 · TG1 if other deviations are recorded · otherwise TG0. Items that were not assessed don't count but are listed in the report.",
};

export interface OverallItem {
  itemKey: string;
  /** Worst grade among the item's active findings (null: no findings). */
  worst: Grade | null;
  /** A TG3 finding on this item needs immediate action. */
  urgent: boolean;
  /** Marked not accessible: not assessed (TGIU). */
  skipped: boolean;
}

export type OverallReason = "urgent" | "two_tg3" | "one_tg3" | "three_tg2" | "deviations" | "none";

export interface OverallResult {
  grade: OverallGrade;
  reason: OverallReason;
  urgentItems: string[];
  tg3Items: string[];
  tg2Items: string[];
  tg1Items: string[];
  notAssessed: string[];
}

/** The overall grade is computed by the published rule, never typed in. Items count once, by their worst grade. */
export function overallGrade(items: OverallItem[]): OverallResult {
  const assessed = items.filter((i) => !i.skipped);
  const withGrade = (g: Grade) => assessed.filter((i) => i.worst === g).map((i) => i.itemKey);
  const urgentItems = assessed.filter((i) => i.urgent).map((i) => i.itemKey);
  const tg3Items = withGrade("TG3");
  const tg2Items = withGrade("TG2");
  const tg1Items = withGrade("TG1");
  const notAssessed = items.filter((i) => i.skipped).map((i) => i.itemKey);

  let grade: OverallGrade = "TG0";
  let reason: OverallReason = "none";
  if (urgentItems.length > 0) [grade, reason] = ["TG3", "urgent"];
  else if (tg3Items.length >= 2) [grade, reason] = ["TG3", "two_tg3"];
  else if (tg3Items.length === 1) [grade, reason] = ["TG2", "one_tg3"];
  else if (tg2Items.length >= 3) [grade, reason] = ["TG2", "three_tg2"];
  else if (tg2Items.length > 0 || tg1Items.length > 0) [grade, reason] = ["TG1", "deviations"];
  return { grade, reason, urgentItems, tg3Items, tg2Items, tg1Items, notAssessed };
}

/** An item counts as not assessed when it was skipped, or when its only findings say it can't be assessed (TGIU). */
export const notAssessedItem = (skipped: boolean, activeFindings: Pick<Finding, "grade">[]) =>
  skipped || (activeFindings.length > 0 && activeFindings.every((f) => f.grade === "TGIU"));

/** Rule input for one checklist item from its active (not rejected) findings. */
export function overallItemOf(itemKey: string, skipped: boolean, activeFindings: Pick<Finding, "grade" | "urgency">[]): OverallItem {
  let worst: Grade | null = null;
  for (const f of activeFindings) if (worst === null || GRADE_INFO[f.grade].severity > GRADE_INFO[worst].severity) worst = f.grade;
  return {
    itemKey,
    worst,
    urgent: activeFindings.some((f) => f.grade === "TG3" && f.urgency === "immediate"),
    skipped: notAssessedItem(skipped, activeFindings),
  };
}

/** One sentence saying which items decided the grade. */
export function overallReasonText(r: OverallResult, lang: Lang, title: (key: string) => string): string {
  const list = (keys: string[]) => keys.map(title).join(", ");
  const is = lang === "is";
  switch (r.reason) {
    case "urgent":
      return is ? `Bráð aðgerð: ${list(r.urgentItems)}.` : `Immediate action needed: ${list(r.urgentItems)}.`;
    case "two_tg3":
      return is ? `${r.tg3Items.length} liðir eru TG3: ${list(r.tg3Items)}.` : `${r.tg3Items.length} items are TG3: ${list(r.tg3Items)}.`;
    case "one_tg3":
      return is ? `Einn liður er TG3: ${list(r.tg3Items)}.` : `One item is TG3: ${list(r.tg3Items)}.`;
    case "three_tg2":
      return is ? `${r.tg2Items.length} liðir eru TG2: ${list(r.tg2Items)}.` : `${r.tg2Items.length} items are TG2: ${list(r.tg2Items)}.`;
    case "deviations": {
      const n = r.tg2Items.length + r.tg1Items.length;
      return is ? `Frávik skráð á ${n} ${n === 1 ? "lið" : "liðum"}, ekkert TG3.` : `Deviations recorded on ${n} ${n === 1 ? "item" : "items"}, none TG3.`;
    }
    default:
      return is ? "Engin frávik skráð á metnum liðum." : "No deviations recorded on the assessed items.";
  }
}

// ---------------------------------------------------------------- cause and consequence

/** TG2 and TG3 findings must say what causes the deviation and what happens if nothing is done. */
export const needsCauseAndConsequence = (grade: Grade) => grade === "TG2" || grade === "TG3";

export function missingCauseOrConsequence(f: Pick<Finding, "grade" | "cause" | "consequence" | "reviewStatus">): boolean {
  return f.reviewStatus !== "rejected" && needsCauseAndConsequence(f.grade) && (!f.cause.trim() || !f.consequence.trim());
}

// ---------------------------------------------------------------- building systems

/** Ten building systems: every report shows the same ten, so reports compare across properties. */
export const SYSTEMS = [
  "roof",
  "exterior_walls",
  "windows_doors",
  "water_supply",
  "drainage",
  "heating_ventilation",
  "electrical",
  "wet_rooms",
  "interior",
  "site_common",
] as const;
export type BuildingSystem = (typeof SYSTEMS)[number];

export const SYSTEM_LABEL: Record<BuildingSystem, L10n> = {
  roof: { is: "Þak og ris", en: "Roof and attic" },
  exterior_walls: { is: "Útveggir og svalir", en: "Exterior walls and balconies" },
  windows_doors: { is: "Gluggar og hurðir", en: "Windows and doors" },
  water_supply: { is: "Neysluvatnslagnir", en: "Water supply" },
  drainage: { is: "Frárennsli og dren", en: "Drains and sewer" },
  heating_ventilation: { is: "Hitakerfi og loftræsing", en: "Heating and ventilation" },
  electrical: { is: "Raflagnir og brunavarnir", en: "Electrical and fire safety" },
  wet_rooms: { is: "Votrými", en: "Wet rooms" },
  interior: { is: "Innra ástand", en: "Interior" },
  site_common: { is: "Lóð, bílskúr og sameign", en: "Grounds, garage and common property" },
};

export const SYSTEM_ICON: Record<BuildingSystem, string> = {
  roof: "bi-house",
  exterior_walls: "bi-bricks",
  windows_doors: "bi-door-open",
  water_supply: "bi-droplet",
  drainage: "bi-arrow-down-circle",
  heating_ventilation: "bi-thermometer-half",
  electrical: "bi-lightning-charge",
  wet_rooms: "bi-moisture",
  interior: "bi-lamp",
  site_common: "bi-tree",
};

/** Where most water damage starts: shown with a droplet so insurers and buyers can find them. */
export const WATER_DAMAGE_SYSTEMS: BuildingSystem[] = ["roof", "water_supply", "drainage", "wet_rooms"];

/** Every checklist item belongs to exactly one system (tests check that none is missing). */
export const ITEM_SYSTEM: Record<string, BuildingSystem> = {
  roof: "roof",
  gutters: "roof",
  attic: "roof",
  chimney_fireplace: "roof",
  facade: "exterior_walls",
  balcony: "exterior_walls",
  windows_ext: "windows_doors",
  windows_int: "windows_doors",
  water_pipes: "water_supply",
  hot_water_tank: "water_supply",
  sewer: "drainage",
  foundation_drainage: "drainage",
  heating_source: "heating_ventilation",
  radiators_floorheat: "heating_ventilation",
  ventilation: "heating_ventilation",
  electrical_panel: "electrical",
  fire_safety: "electrical",
  bathroom: "wet_rooms",
  laundry: "wet_rooms",
  walls_ceilings: "interior",
  floors: "interior",
  kitchen: "interior",
  stairs_railings: "interior",
  basement_storage: "interior",
  crawl_space: "interior",
  garage: "site_common",
  hot_tub: "site_common",
  hoa_statement: "site_common",
};

export const systemOf = (itemKey: string): BuildingSystem => ITEM_SYSTEM[itemKey] ?? "interior";

export type SystemTone = "red" | "amber" | "green" | "grey" | "none";

export interface SystemItemInput {
  itemKey: string;
  skipped: boolean;
  analyzed: boolean;
  worst: Grade | null;
  findingTitles: string[];
}

export interface SystemStatus {
  system: BuildingSystem;
  tone: SystemTone;
  worst: Grade | null;
  itemKeys: string[];
  assessed: number;
  notAssessed: number;
  findingTitles: string[];
  /** The item to show for this system on the 3D house: the most serious one, else the first assessed. */
  focusKey: string | null;
}

/** Traffic light per system: red = TG3, amber = TG2, green = assessed without TG2/TG3, grey = nothing assessed. */
export function systemStatuses(items: SystemItemInput[]): SystemStatus[] {
  return SYSTEMS.map((system) => {
    const mine = items.filter((i) => systemOf(i.itemKey) === system);
    let worst: Grade | null = null;
    for (const i of mine) {
      if (i.skipped || !i.worst || i.worst === "TGIU") continue;
      if (worst === null || GRADE_INFO[i.worst].severity > GRADE_INFO[worst].severity) worst = i.worst;
    }
    const assessed = mine.filter((i) => !i.skipped && (i.analyzed || i.worst !== null)).length;
    const notAssessed = mine.filter((i) => i.skipped).length;
    const tone: SystemTone =
      mine.length === 0 ? "none" : worst === "TG3" ? "red" : worst === "TG2" ? "amber" : assessed > 0 ? "green" : "grey";
    const live = mine.filter((i) => !i.skipped && (i.analyzed || i.worst !== null));
    const focus = [...live].sort((a, b) => (b.worst ? GRADE_INFO[b.worst].severity : -2) - (a.worst ? GRADE_INFO[a.worst].severity : -2))[0];
    return {
      system,
      tone,
      worst,
      itemKeys: mine.map((i) => i.itemKey),
      assessed,
      notAssessed,
      findingTitles: mine.flatMap((i) => i.findingTitles),
      focusKey: focus?.itemKey ?? null,
    };
  });
}

// ---------------------------------------------------------------- moisture readings

/**
 * Resistance (pin) meter readings as wood moisture equivalent, WME %.
 * Provisional limits: confirm them with the inspectors who use the meters before relying on them.
 */
export const MOISTURE_LIMITS = { atRisk: 17, wet: 20 } as const;
export type MoistureLevel = "dry" | "at_risk" | "wet";
export const moistureLevel = (wme: number): MoistureLevel =>
  wme > MOISTURE_LIMITS.wet ? "wet" : wme >= MOISTURE_LIMITS.atRisk ? "at_risk" : "dry";

export const MOISTURE_LEVEL_LABEL: Record<MoistureLevel, L10n> = {
  dry: { is: "Þurrt", en: "Dry" },
  at_risk: { is: "Áhættusvæði", en: "At risk" },
  wet: { is: "Blautt", en: "Wet" },
};

export const MOISTURE_METHODS = ["pin", "pinless"] as const;
export type MoistureMethod = (typeof MOISTURE_METHODS)[number];
export const MOISTURE_METHOD_LABEL: Record<MoistureMethod, L10n> = {
  pin: { is: "Viðnámsmælir (pinnar)", en: "Pin meter (resistance)" },
  pinless: { is: "Snertimælir (án pinna)", en: "Pinless meter" },
};

/** A reading as text: decimal comma in Icelandic. Done by hand so server and browser always agree. */
export const formatReading = (value: number, lang: Lang) => {
  const text = String(Math.round(value * 10) / 10);
  return lang === "is" ? text.replace(".", ",") : text;
};

export const moistureScaleText = (lang: Lang) =>
  lang === "is"
    ? `Viðmið (WME %): undir ${MOISTURE_LIMITS.atRisk} þurrt · ${MOISTURE_LIMITS.atRisk}–${MOISTURE_LIMITS.wet} áhættusvæði · yfir ${MOISTURE_LIMITS.wet} blautt`
    : `Scale (WME %): below ${MOISTURE_LIMITS.atRisk} dry · ${MOISTURE_LIMITS.atRisk}–${MOISTURE_LIMITS.wet} at risk · above ${MOISTURE_LIMITS.wet} wet`;

// ---------------------------------------------------------------- AI–inspector agreement

/** Same measure as for double inspections: share of items where both give the same or an adjacent grade. */
export const AGREEMENT_TARGET_PCT = 80;

export interface AgreementPair {
  itemKey: string;
  ai: Grade;
  inspector: Grade;
}

const sev = (g: Grade) => GRADE_INFO[g].severity;

/**
 * Item-level comparison for one signed inspection: the AI's worst original grade against the
 * inspector's final worst grade (TG0 when an item has no findings). Items the AI never analysed,
 * items not assessed, and items whose original AI grade is unknown are left out.
 */
export function agreementPairs(
  items: { itemKey: string; analyzed: boolean; skipped: boolean }[],
  findings: Pick<Finding, "itemKey" | "source" | "grade" | "aiGrade" | "reviewStatus">[],
): AgreementPair[] {
  const pairs: AgreementPair[] = [];
  for (const item of items) {
    if (!item.analyzed || item.skipped) continue;
    const mine = findings.filter((f) => f.itemKey === item.itemKey);
    const ai = mine.filter((f) => f.source === "ai");
    if (ai.some((f) => f.aiGrade === null)) continue; // edited before original grades were kept
    const worstOf = (gs: Grade[]) => gs.filter((g) => g !== "TGIU").reduce<Grade>((w, g) => (sev(g) > sev(w) ? g : w), "TG0");
    const aiWorst = worstOf(ai.map((f) => f.aiGrade as Grade));
    const finalWorst = worstOf(mine.filter((f) => f.reviewStatus !== "rejected").map((f) => f.grade));
    if (ai.some((f) => f.aiGrade === "TGIU") && aiWorst === "TG0") continue; // AI could not assess it
    pairs.push({ itemKey: item.itemKey, ai: aiWorst, inspector: finalWorst });
  }
  return pairs;
}

export interface AgreementStats {
  items: number;
  exact: number;
  withinOne: number;
  exactPct: number | null;
  withinOnePct: number | null;
}

export function agreementStats(pairs: AgreementPair[]): AgreementStats {
  const exact = pairs.filter((p) => p.ai === p.inspector).length;
  const withinOne = pairs.filter((p) => Math.abs(sev(p.ai) - sev(p.inspector)) <= 1).length;
  const pct = (n: number) => (pairs.length ? Math.round((n / pairs.length) * 1000) / 10 : null);
  return { items: pairs.length, exact, withinOne, exactPct: pct(exact), withinOnePct: pct(withinOne) };
}

// ---------------------------------------------------------------- seal (fingerprint)

/** JSON with object keys sorted at every level, so the same content always gives the same bytes. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value)) return "null";
  return JSON.stringify(value);
}

/** Short, readable form of a SHA-256 fingerprint: the first 16 hex digits in groups of four. */
export const shortFingerprint = (hash: string) =>
  hash
    .slice(0, 16)
    .toUpperCase()
    .replace(/(.{4})(?=.)/g, "$1-");

/** Normalise a typed verification code (any case, dashes, spaces) to lowercase hex, or null. */
export function normalizeFingerprint(code: string): string | null {
  const hex = code.replace(/[\s-]/g, "").toLowerCase();
  return /^[0-9a-f]{16,64}$/.test(hex) ? hex : null;
}
