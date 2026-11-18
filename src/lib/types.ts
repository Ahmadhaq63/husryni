export type Lang = "is" | "en";
export type L10n = { is: string; en: string };

/**
 * Condition grades, modelled on the Norwegian NS 3600 "tilstandsgrad" scale
 * (TG0–TG3 + TGIU) which is also close to the Danish K0–K3/UN scale.
 */
export const GRADES = ["TG0", "TG1", "TG2", "TG3", "TGIU"] as const;
export type Grade = (typeof GRADES)[number];

export const PROPERTY_TYPES = ["fjolbyli", "einbyli", "radhus", "parhus", "sumarhus"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const CONSTRUCTION_TYPES = ["steypa", "timbur", "stal", "hladid", "annad"] as const;
export type ConstructionType = (typeof CONSTRUCTION_TYPES)[number];

export const HEATING_TYPES = ["hitaveita", "rafmagn", "varmadaela", "annad"] as const;
export type HeatingType = (typeof HEATING_TYPES)[number];

/** Who orders the report: seller before listing, buyer before purchase, or an owner checking their home. */
export const PURPOSES = ["seller", "buyer", "owner"] as const;
export type Purpose = (typeof PURPOSES)[number];

/** basic = AI pre-screening only; verified = AI draft reviewed and signed by a certified inspector. */
export const TIERS = ["basic", "verified"] as const;
export type Tier = (typeof TIERS)[number];

export const STATUSES = ["capturing", "in_review", "ai_report", "verified"] as const;
export type InspectionStatus = (typeof STATUSES)[number];

export const FOLLOW_UPS = [
  "none",
  "moisture_measurement",
  "mold_sampling",
  "sewer_camera",
  "electrician",
  "plumber",
  "roofer",
  "structural_engineer",
  "ventilation_specialist",
] as const;
export type FollowUp = (typeof FOLLOW_UPS)[number];

export const URGENCIES = ["immediate", "within_1y", "within_5y", "monitor"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const CONFIDENCES = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export interface PropertyProfile {
  propertyType: PropertyType;
  buildYear: number;
  sizeM2: number;
  construction: ConstructionType;
  heating: HeatingType;
  hasBasement: boolean;
  hasAttic: boolean;
  /** Answers to "does the property have …?" — each adds checklist items (Nestic-style question-driven checklist). */
  hasGarage?: boolean;
  hasFireplace?: boolean;
  hasHotTub?: boolean;
}

/**
 * Official construction stage under ÍST 51:2021 as registered by the building authority:
 * B3 = safety inspection (öryggisúttekt) done, B4 = final inspection (lokaúttekt) done.
 */
export const CONSTRUCTION_STAGES = ["B4", "B3", "B1_B2", "unknown"] as const;
export type ConstructionStage = (typeof CONSTRUCTION_STAGES)[number];

export interface Inspection extends PropertyProfile {
  id: string;
  createdAt: string;
  status: InspectionStatus;
  tier: Tier;
  purpose: Purpose;
  lang: Lang;
  address: string;
  postalCode: string;
  fastanumer: string | null;
  contactName: string;
  contactEmail: string;
  /** Optional purchase/asking price, used to express repair costs as a share of the price. */
  priceIsk: number | null;
  constructionStage: ConstructionStage | null;
  inspectorName: string | null;
  inspectorLicense: string | null;
  inspectorStatement: string | null;
  signedAt: string | null;
  summary: InspectionSummaryAI | null;
}

export type ItemStatus = "pending" | "analyzed" | "skipped";

export interface InspectionItem {
  id: number;
  inspectionId: string;
  itemKey: string;
  position: number;
  status: ItemStatus;
  notes: string;
  notAccessible: boolean;
  analysis: ItemAnalysisRecord | null;
}

/** camera = taken live in the app; upload = picked from the device's library (weaker evidence). */
export type PhotoSource = "camera" | "upload";

/** Instant check by a fast model right after upload, before the detailed (expensive) analysis. */
export type PhotoCheckStatus = "unchecked" | "ok" | "retake";

export interface Photo {
  id: string;
  inspectionId: string;
  itemKey: string;
  source: PhotoSource;
  checkStatus: PhotoCheckStatus;
  checkReason: string | null;
  mime: string;
  sizeBytes: number;
  createdAt: string;
}

export type FindingSource = "ai" | "inspector";
export type ReviewStatus = "pending" | "confirmed" | "edited" | "rejected";

export interface Finding {
  id: string;
  inspectionId: string;
  itemKey: string;
  source: FindingSource;
  title: string;
  description: string;
  grade: Grade;
  confidence: Confidence;
  photoIds: string[];
  recommendedAction: string;
  followUp: FollowUp;
  urgency: Urgency;
  costKey: string;
  reviewStatus: ReviewStatus;
  inspectorNote: string;
  createdAt: string;
  updatedAt: string;
}

/** What we keep about one AI run on one checklist item (besides the findings rows). */
export interface ItemAnalysisRecord {
  engine: "claude" | "mock";
  model: string;
  analyzedAt: string;
  sufficient: boolean;
  retakeRequests: { photoNumber: number | null; reason: string }[];
  privacyFlags: { photoNumber: number; issue: string }[];
  itemSummary: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface InspectionSummaryAI {
  engine: "claude" | "mock";
  overall: string;
  keyRisks: string[];
  advice: string;
  generatedAt: string;
}

export interface InspectionBundle {
  inspection: Inspection;
  items: InspectionItem[];
  photos: Photo[];
  findings: Finding[];
}

// ---------------------------------------------------------------- remedies & negotiation

/**
 * What should happen with a finding after the report (Icelandic sale process):
 * the seller repairs before handover (afhending), the price is reduced (afsláttur),
 * it is common property handled by the owners' association (sameign / húsfélag),
 * or the buyer accepts it as is.
 */
export const REMEDY_ACTIONS = ["none", "seller_fix", "price_reduction", "hoa", "accept"] as const;
export type RemedyAction = (typeof REMEDY_ACTIONS)[number];

export const SELLER_RESPONSES = ["none", "accepted", "disputed"] as const;
export type SellerResponse = (typeof SELLER_RESPONSES)[number];

/** Why a seller disputes an item. "already_disclosed" matters legally: disclosed defects generally can't be claimed (Act 40/2002). */
export const DISPUTE_REASONS = ["normal_wear", "already_disclosed", "misread", "already_fixed", "other"] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export const FIX_VERDICTS = ["fixed", "partially_fixed", "not_fixed", "cannot_tell"] as const;
export type FixVerdictValue = (typeof FIX_VERDICTS)[number];
export type FixStatus = "none" | "submitted" | FixVerdictValue;

export interface FixVerdict {
  engine: "claude" | "mock";
  model: string;
  verdict: FixVerdictValue;
  explanation: string;
  remainingIssues: string[];
  retakeRequests: { photoNumber: number | null; reason: string }[];
  checkedAt: string;
}

export interface Negotiation {
  inspectionId: string;
  shareToken: string;
  /** Buyer's share of the common property (eignarhlutfall from the eignaskiptayfirlýsing), in percent. */
  ownerSharePct: number | null;
  responseDeadline: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface Remedy {
  findingId: string;
  inspectionId: string;
  action: RemedyAction;
  amountIsk: number | null;
  remark: string;
  sellerResponse: SellerResponse;
  disputeReason: DisputeReason | null;
  sellerComment: string;
  fixStatus: FixStatus;
  fixVerdict: FixVerdict | null;
  updatedAt: string;
}
