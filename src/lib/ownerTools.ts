import { estimateIsk } from "./negotiation";
import { systemOf, type BuildingSystem } from "./standard";
import type { Finding, FollowUp, L10n, Lang, Urgency } from "./types";

/**
 * Owner tools around a final report: read-only links for others (insurers, banks), repair quote drafts per
 * trade ("draft from the findings, a person approves"), and triage of problems reported between checks.
 * Pure logic (client-safe); the database side is in ownerRepo.ts.
 */

// ---------------------------------------------------------------- read-only links

export const AUDIENCES = ["insurer", "bank", "buyer", "other"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const AUDIENCE_LABEL: Record<Audience, L10n> = {
  insurer: { is: "Tryggingafélag", en: "Insurer" },
  bank: { is: "Banki / lánveitandi", en: "Bank / lender" },
  buyer: { is: "Kaupandi eða fasteignasali", en: "Buyer or realtor" },
  other: { is: "Annað", en: "Other" },
};

// ---------------------------------------------------------------- trades and quotes

export const TRADES = ["plumber", "electrician", "carpenter", "roofer", "mason", "painter", "sheet_metal", "general"] as const;
export type Trade = (typeof TRADES)[number];
export const TRADE_LABEL: Record<Trade, L10n> = {
  plumber: { is: "Pípari", en: "Plumber" },
  electrician: { is: "Rafvirki", en: "Electrician" },
  carpenter: { is: "Smiður", en: "Carpenter" },
  roofer: { is: "Þakverktaki", en: "Roofer" },
  mason: { is: "Múrari", en: "Mason" },
  painter: { is: "Málari", en: "Painter" },
  sheet_metal: { is: "Blikksmiður", en: "Sheet-metal worker" },
  general: { is: "Verktaki", en: "Contractor" },
};

/** PLACEHOLDER hourly rates, ISK excl. VAT, until real contractor price lists are in (like the cost catalogue). */
export const TRADE_RATE: Record<Trade, number> = {
  plumber: 14_900,
  electrician: 14_500,
  carpenter: 13_900,
  roofer: 14_800,
  mason: 13_500,
  painter: 12_500,
  sheet_metal: 14_200,
  general: 13_500,
};
/** Setup, travel and disposal per job, ISK excl. VAT (placeholder). */
export const SETUP_FEE = 24_500;
export const VAT_RATE = 0.24;

const SYSTEM_TRADE: Record<BuildingSystem, Trade> = {
  roof: "roofer",
  exterior_walls: "mason",
  windows_doors: "carpenter",
  water_supply: "plumber",
  drainage: "plumber",
  heating_ventilation: "plumber",
  electrical: "electrician",
  wet_rooms: "plumber",
  interior: "carpenter",
  site_common: "carpenter",
};
const ITEM_TRADE: Partial<Record<string, Trade>> = { gutters: "sheet_metal", ventilation: "sheet_metal", fire_safety: "electrician" };
const FOLLOWUP_TRADE: Partial<Record<FollowUp, Trade>> = {
  electrician: "electrician",
  plumber: "plumber",
  roofer: "roofer",
  ventilation_specialist: "sheet_metal",
};
const COST_TRADE: Partial<Record<string, Trade>> = {
  roof_repaint: "painter",
  interior_repaint: "painter",
  facade_repair_paint: "mason",
  window_glass_unit: "carpenter",
  gutter_replace: "sheet_metal",
  electrical_panel_upgrade: "electrician",
  rewiring: "electrician",
};

/** Which trade a finding goes to: by the remedy's cost item, the follow-up, the item, then its building system. */
export function tradeFor(f: Pick<Finding, "itemKey" | "followUp" | "costKey">): Trade {
  return COST_TRADE[f.costKey] ?? FOLLOWUP_TRADE[f.followUp] ?? ITEM_TRADE[f.itemKey] ?? SYSTEM_TRADE[systemOf(f.itemKey)] ?? "general";
}

export interface QuoteLine {
  description: string;
  qty: number;
  unit: string;
  /** ISK excl. VAT. */
  unitPrice: number;
}

export const QUOTE_STATUSES = ["draft", "sent", "approved"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

const round = (n: number, step: number) => Math.round(n / step) * step;

/**
 * Draft lines for one trade from the findings: labour (hours × rate) and materials split from the midpoint of
 * the finding's cost range (incl. VAT → excl. VAT; about 55 % labour, 40 % materials), plus one setup line.
 * A finding without a cost range gets two hours for assessment and repair. A person reviews every line.
 */
export function draftQuoteLines(findings: Finding[], trade: Trade, lang: Lang): QuoteLine[] {
  const rate = TRADE_RATE[trade];
  const hoursUnit = lang === "is" ? "klst." : "h";
  const lotUnit = lang === "is" ? "heild" : "lot";
  const lines: QuoteLine[] = [];
  for (const f of findings) {
    const net = estimateIsk(f) / (1 + VAT_RATE);
    if (net > 0) {
      lines.push({
        description: lang === "is" ? `${f.title}: vinna (${TRADE_LABEL[trade].is.toLowerCase()})` : `${f.title}: labour (${TRADE_LABEL[trade].en.toLowerCase()})`,
        qty: Math.max(2, Math.round((net * 0.55) / rate)),
        unit: hoursUnit,
        unitPrice: rate,
      });
      lines.push({ description: lang === "is" ? `${f.title}: efni` : `${f.title}: materials`, qty: 1, unit: lotUnit, unitPrice: round(net * 0.4, 1000) });
    } else {
      lines.push({ description: lang === "is" ? `${f.title}: mat og viðgerð` : `${f.title}: assessment and repair`, qty: 2, unit: hoursUnit, unitPrice: rate });
    }
  }
  lines.push({ description: lang === "is" ? "Aðstaða, akstur og förgun" : "Setup, travel and disposal", qty: 1, unit: lotUnit, unitPrice: SETUP_FEE });
  return lines;
}

export function quoteTotals(lines: QuoteLine[]): { net: number; vat: number; total: number } {
  const net = Math.round(lines.reduce((s, l) => s + (Number.isFinite(l.qty) ? l.qty : 0) * (Number.isFinite(l.unitPrice) ? l.unitPrice : 0), 0));
  const vat = Math.round(net * VAT_RATE);
  return { net, vat, total: net + vat };
}

// ---------------------------------------------------------------- problem reports (triage)

export const PROBLEM_CATEGORIES = ["water_leak", "damp_mould", "electrical", "heating", "doors_windows", "roof", "drains", "other"] as const;
export type ProblemCategory = (typeof PROBLEM_CATEGORIES)[number];
export const PROBLEM_CATEGORY_LABEL: Record<ProblemCategory, L10n> = {
  water_leak: { is: "Vatnsleki", en: "Water leak" },
  damp_mould: { is: "Raki eða mygla", en: "Damp or mould" },
  electrical: { is: "Rafmagn", en: "Electrical" },
  heating: { is: "Hitakerfi", en: "Heating" },
  doors_windows: { is: "Hurðir og gluggar", en: "Doors and windows" },
  roof: { is: "Þak", en: "Roof" },
  drains: { is: "Niðurföll og frárennsli", en: "Drains" },
  other: { is: "Annað", en: "Other" },
};

export const RESPONSE_TIMES = ["4h", "24h", "48h", "5d", "next_check"] as const;
export type ResponseTime = (typeof RESPONSE_TIMES)[number];
export const RESPONSE_TIME_LABEL: Record<ResponseTime, L10n> = {
  "4h": { is: "innan 4 klukkustunda", en: "within 4 hours" },
  "24h": { is: "innan sólarhrings", en: "within 24 hours" },
  "48h": { is: "innan tveggja daga", en: "within 2 days" },
  "5d": { is: "innan 5 virkra daga", en: "within 5 working days" },
  next_check: { is: "fyrir næstu árlegu skoðun", en: "before the next yearly check" },
};

export interface Triage {
  engine: "claude" | "mock";
  category: ProblemCategory;
  trade: Trade;
  urgency: Urgency;
  respondWithin: ResponseTime;
  advice: string;
  itemKey: string | null;
}

/** Demo triage when no AI is configured: keyword rules, the same idea as a 24/7 fault line routing by trade. */
export function ruleTriage(text: string, lang: Lang): Omit<Triage, "engine"> {
  const t = text.toLowerCase();
  const is = lang === "is";
  if (/lek|drop|flæð|vatn úr|vatn á gólf|poll|leak|drip|flood|water on the floor/.test(t)) {
    return {
      category: "water_leak",
      trade: "plumber",
      urgency: "immediate",
      respondWithin: "4h",
      advice: is
        ? "Skrúfaðu fyrir aðalvatnsinntakið ef lekinn er mikill og þurrkaðu upp. Taktu myndir af skemmdunum fyrir tryggingafélagið."
        : "Turn off the main water valve if the leak is heavy and mop up. Take photos of the damage for your insurer.",
      itemKey: "water_pipes",
    };
  }
  if (/rak|myg|sagg|fúkk|damp|mould|mold|musty/.test(t)) {
    return {
      category: "damp_mould",
      trade: "plumber",
      urgency: "within_1y",
      respondWithin: "48h",
      advice: is ? "Loftaðu vel út og láttu rakamæla svæðið áður en það er málað yfir." : "Ventilate well and have the area moisture-tested before painting over it.",
      itemKey: "bathroom",
    };
  }
  if (/rafm|ljós|tengil|öryggi|neista|brunalykt|electric|socket|fuse|spark|burning/.test(t)) {
    return {
      category: "electrical",
      trade: "electrician",
      urgency: "immediate",
      respondWithin: "24h",
      advice: is ? "Ef það er brunalykt eða reykur: taktu strauminn af og hringdu í 112." : "If there is a burning smell or smoke: switch off the power and call 112.",
      itemKey: "electrical_panel",
    };
  }
  if (/ofn|hiti|kalt|heitt vatn|radiator|heating|cold|hot water/.test(t)) {
    return { category: "heating", trade: "plumber", urgency: "within_1y", respondWithin: "24h", advice: "", itemKey: "radiators_floorheat" };
  }
  if (/hurð|lás|glugg|lam|door|lock|window/.test(t)) {
    return { category: "doors_windows", trade: "carpenter", urgency: "within_1y", respondWithin: "48h", advice: "", itemKey: "windows_ext" };
  }
  if (/þak|roof/.test(t)) {
    return { category: "roof", trade: "roofer", urgency: "within_1y", respondWithin: "48h", advice: "", itemKey: "roof" };
  }
  if (/niðurf|stífl|skólp|drain|blocked|sewer/.test(t)) {
    return { category: "drains", trade: "plumber", urgency: "within_1y", respondWithin: "48h", advice: "", itemKey: "sewer" };
  }
  return { category: "other", trade: "general", urgency: "monitor", respondWithin: "5d", advice: "", itemKey: null };
}

/** ISK amount as text, formatted by hand so a server render and a browser render always match. */
export function iskText(n: number, lang: Lang): string {
  const digits = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, lang === "is" ? "." : ",");
  return `${n < 0 ? "−" : ""}${digits} kr.`;
}
