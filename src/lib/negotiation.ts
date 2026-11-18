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

/** Share of the estimated cost of serious (TG3) repairs that the seller won't fix, held back as a risk buffer. */
export const OFFER_RISK_BUFFER = 0.2;

export interface OfferGuide {
  asking: number;
  reductions: number;
  hoaShare: number;
  buffer: number;
  offer: number;
  belowPct: number;
}

/**
 * A suggested offer for a buyer: the asking price minus the price reductions they ask for, their share of
 * common-property repairs, and a risk buffer on serious (TG3) repairs that the seller won't fix before handover
 * (their scope is usually uncertain). Rounded down to 100,000 kr. An aid for the offer, not a valuation.
 */
export function offerGuide(
  priceIsk: number,
  findings: Finding[],
  remedies: Map<string, Remedy>,
  totals: NegotiationTotals,
  ownerSharePct: number | null = null,
): OfferGuide {
  // Common-property repairs fall on the buyer only in proportion to their share, so does the risk on them.
  const share = ownerSharePct != null ? Math.min(Math.max(ownerSharePct, 0), 100) / 100 : 1;
  const uncertain = findings
    .filter((f) => f.grade === "TG3" && remedies.get(f.id)?.action !== "seller_fix")
    .reduce((sum, f) => sum + estimateIsk(f) * (remedies.get(f.id)?.action === "hoa" ? share : 1), 0);
  const buffer = roundTo(uncertain * OFFER_RISK_BUFFER, 10_000);
  const raw = priceIsk - totals.priceReduction - totals.hoaBuyerShare - buffer;
  const offer = Math.max(0, Math.floor(raw / 100_000) * 100_000);
  return {
    asking: priceIsk,
    reductions: totals.priceReduction,
    hoaShare: totals.hoaBuyerShare,
    buffer,
    offer,
    belowPct: priceIsk ? ((priceIsk - offer) / priceIsk) * 100 : 0,
  };
}

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

/** The negotiation is only available once the report itself is final (and never on a yearly owner check). */
export const negotiationOpen = (status: string, kind: string = "full") => kind === "full" && (status === "ai_report" || status === "verified");
