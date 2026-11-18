import { getCost } from "./costs";
import { activeFindings, bySeverityDesc } from "./report";
import type { Finding, InspectionBundle, L10n, PropertyType, Remedy, RemedyAction } from "./types";

/**
 * Remedies & negotiation — adapted from the "who fixes it" step of Nestic's
 * maintenance protocol (approved / approved with remark / fixed by tenant /
 * fixed by landlord) to the Icelandic sale process after an inspection.
 */

export const hasOwnersAssociation = (t: PropertyType) => t === "fjolbyli" || t === "radhus" || t === "parhus";

/**
 * Components that are usually common property (sameign) in multi-unit buildings.
 * Only a hint: the building's declaration of division (eignaskiptayfirlýsing) decides.
 */
const USUALLY_COMMON = new Set(["roof", "gutters", "facade", "foundation_drainage", "sewer"]);
export const likelyCommonProperty = (itemKey: string, t: PropertyType) => hasOwnersAssociation(t) && USUALLY_COMMON.has(itemKey);

/** Findings worth negotiating: active (not rejected) TG1–TG3, most severe first. */
export function negotiableFindings(bundle: InspectionBundle): Finding[] {
  return activeFindings(bundle.findings)
    .filter((f) => f.grade === "TG1" || f.grade === "TG2" || f.grade === "TG3")
    .sort(bySeverityDesc);
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Midpoint of the catalogue range, rounded to 10,000 kr. (0 when no cost item). */
export function estimateIsk(f: Finding): number {
  const c = getCost(f.costKey);
  return c ? roundTo((c.minIsk + c.maxIsk) / 2, 10_000) : 0;
}

export interface NegotiationTotals {
  counts: Record<RemedyAction, number>;
  /** Sum of requested price reductions. */
  priceReduction: number;
  /** Estimated value of repairs the seller is asked to do. */
  sellerFixValue: number;
  /** Estimated full cost of common-property items, and the buyer's share of it. */
  hoaFullCost: number;
  hoaBuyerShare: number;
  /** Estimated cost of items the buyer accepts as they are. */
  acceptedValue: number;
  /** What the buyer asks the seller to cover (reduction + repairs). */
  requestedFromSeller: number;
  /** What the buyer will carry (accepted items + share of common property). */
  buyerBears: number;
  /** Estimated cost of all negotiable findings (midpoints, common property at the buyer's share). */
  allRepairs: number;
}

export function computeTotals(findings: Finding[], remedies: Map<string, Remedy>, ownerSharePct: number | null): NegotiationTotals {
  const counts = { none: 0, seller_fix: 0, price_reduction: 0, hoa: 0, accept: 0 } as Record<RemedyAction, number>;
  let priceReduction = 0;
  let sellerFixValue = 0;
  let hoaFullCost = 0;
  let acceptedValue = 0;
  let allRepairs = 0;
  const share = ownerSharePct != null ? Math.min(Math.max(ownerSharePct, 0), 100) / 100 : 1;

  for (const f of findings) {
    const r = remedies.get(f.id);
    const action = r?.action ?? "none";
    const est = estimateIsk(f);
    counts[action]++;
    switch (action) {
      case "price_reduction":
        priceReduction += r?.amountIsk ?? est;
        allRepairs += est;
        break;
      case "seller_fix":
        sellerFixValue += est;
        allRepairs += est;
        break;
      case "hoa":
        hoaFullCost += est;
        allRepairs += est * share;
        break;
      case "accept":
        acceptedValue += est;
        allRepairs += est;
        break;
      default:
        allRepairs += est;
    }
  }
  const hoaBuyerShare = Math.round(hoaFullCost * share);
  return {
    counts,
    priceReduction,
    sellerFixValue,
    hoaFullCost,
    hoaBuyerShare,
    acceptedValue,
    requestedFromSeller: priceReduction + sellerFixValue,
    buyerBears: acceptedValue + hoaBuyerShare,
    allRepairs: Math.round(allRepairs),
  };
}

export const pctOf = (part: number, whole: number | null) => (whole ? (part / whole) * 100 : null);

/**
 * Reference points shown next to the totals. Information, not legal advice.
 * Sources: docs/business-plan.md [I25]–[I28].
 */
export const LEGAL_REFERENCE: { proposal2pct: L10n; caseLaw: L10n } = {
  proposal2pct: {
    is: "Starfshópur ráðuneytisins lagði til árið 2024 að ef viðgerðarkostnaður er undir 2% af kaupverði standi kaupin, en annars semji aðilar. Tillagan hefur ekki verið lögfest.",
    en: "A 2024 ministry working group proposed that if repair costs are under 2% of the price the sale stands, and above that the parties negotiate. The proposal has not been enacted.",
  },
  caseLaw: {
    is: "Notuð eign telst aðeins gölluð ef ágalli rýrir verðmæti hennar svo nokkru varði (lög nr. 40/2002, 18. gr.); í dómaframkvæmd hefur oft verið miðað við um 7–10% af kaupverði. Atriði sem komu fram í söluyfirliti eða áttu að sjást við venjulega skoðun teljast almennt ekki gallar.",
    en: "A used property is only defective if a fault reduces its value to a meaningful degree (Act 40/2002, art. 18); case law has often used roughly 7–10% of the price. Items disclosed in the sales summary, or visible on an ordinary inspection, are generally not defects.",
  },
};

/** The negotiation is only available once the report itself is final. */
export const negotiationOpen = (status: string) => status === "ai_report" || status === "verified";
