import { z } from "zod";
import { CONFIDENCES, FIX_VERDICTS, FOLLOW_UPS, FOLLOWUP_VERDICTS, GRADES, URGENCIES } from "../types";
import { COST_KEYS } from "../costs";
import { ITEM_TEMPLATES } from "../checklist";
import { PROBLEM_CATEGORIES, RESPONSE_TIMES, TRADES } from "../ownerTools";

const COST_KEY_ENUM = ["none", ...COST_KEYS] as [string, ...string[]];

export const FindingSchema = z.object({
  title: z.string().describe("Short name of the issue (max ~8 words), in the report language."),
  description: z.string().describe("What is visible and why it matters, 1–3 sentences, in the report language."),
  cause: z
    .string()
    .describe('TG2/TG3: the most likely cause, one sentence ("may be caused by …" when it is not visible). Empty string for TG0, TG1 and TGIU.'),
  consequence: z
    .string()
    .describe("TG2/TG3: what is likely to happen if nothing is done, one sentence. Empty string for TG0, TG1 and TGIU."),
  grade: z.enum(GRADES),
  confidence: z.enum(CONFIDENCES),
  photo_numbers: z.array(z.number().int()).describe("1-based numbers of the photos that show this finding."),
  recommended_action: z.string().describe("Concrete next step for the client, in the report language."),
  follow_up: z.enum(FOLLOW_UPS),
  urgency: z.enum(URGENCIES),
  cost_key: z.enum(COST_KEY_ENUM).describe('Cost catalogue key for the likely remedy, or "none".'),
});

export const ItemAnalysisSchema = z.object({
  photos_sufficient: z.boolean().describe("true when the photos show the component well enough to assess it."),
  retake_requests: z.array(
    z.object({
      photo_number: z
        .number()
        .int()
        .nullable()
        .describe("Photo to retake, or null when an additional photo is needed."),
      reason: z.string().describe("Instruction to the person taking photos, in the report language."),
    }),
  ),
  privacy_flags: z.array(
    z.object({
      photo_number: z.number().int(),
      issue: z.string().describe("Kind of personal data visible (do not repeat the data itself)."),
    }),
  ),
  findings: z.array(FindingSchema),
  item_summary: z.string().describe("1–2 sentence assessment of this component, in the report language."),
});

export type ItemAnalysis = z.infer<typeof ItemAnalysisSchema>;
export type AiFinding = z.infer<typeof FindingSchema>;

export const SummarySchema = z.object({
  overall: z.string().describe("3–5 sentence plain-language summary of the property's condition."),
  key_risks: z.array(z.string()).describe("Most important risks, most severe first, max 5."),
  advice: z.string().describe("What the client should do next, given their role (seller/buyer/owner)."),
});

export type SummaryOutput = z.infer<typeof SummarySchema>;

/** Before/after comparison of one repaired finding (seller's fix photos vs inspection photos). */
export const FixCheckSchema = z.object({
  verdict: z.enum(FIX_VERDICTS),
  same_location: z.enum(["yes", "no", "unsure"]).describe("Do the AFTER photos show the same spot as the BEFORE photos?"),
  explanation: z.string().describe("2–3 sentences: what changed and why this verdict, in the report language."),
  remaining_issues: z.array(z.string()).describe("Visible issues that remain, or risks a cosmetic repair may hide."),
  retake_requests: z.array(
    z.object({
      photo_number: z.number().int().nullable().describe("AFTER photo to retake, or null when an additional photo is needed."),
      reason: z.string().describe("Instruction to the seller, in the report language."),
    }),
  ),
});

export type FixCheck = z.infer<typeof FixCheckSchema>;

/** Yearly check: the report's BEFORE photos of a finding against the owner's AFTER photos a year later. */
export const FollowUpCheckSchema = z.object({
  verdict: z.enum(FOLLOWUP_VERDICTS),
  same_location: z.enum(["yes", "no", "unsure"]).describe("Do the AFTER photos show the same spot as the BEFORE photos (or the described defect)?"),
  explanation: z.string().describe("2–3 sentences: what has changed and why this verdict, in the report language."),
  retake_requests: z.array(
    z.object({
      photo_number: z.number().int().nullable().describe("AFTER photo to retake, or null when an additional photo is needed."),
      reason: z.string().describe("Instruction to the owner, in the report language."),
    }),
  ),
});

export type FollowUpCheck = z.infer<typeof FollowUpCheckSchema>;

/** Instant usability check of one photo (fast model). Not a defect assessment. */
export const PHOTO_ISSUES = ["ok", "too_dark", "blurry", "wrong_subject", "too_far", "too_close", "obstructed", "personal_data", "other"] as const;
export type PhotoIssue = (typeof PHOTO_ISSUES)[number];

// Only a verdict and a code: the user-facing advice is fixed, reviewed text per code (the fast model's
// Icelandic is weaker, and fixed text is cheaper and consistent).
export const PhotoCheckSchema = z.object({
  usable: z.boolean().describe("true unless the photo cannot be used to assess the requested component."),
  issue: z.enum(PHOTO_ISSUES).describe('The main problem, or "ok" when usable.'),
});

export type PhotoCheck = z.infer<typeof PhotoCheckSchema>;

/** Triage of a problem the owner reports between checks: who to call, how fast, what to do now. */
export const TriageSchema = z.object({
  category: z.enum(PROBLEM_CATEGORIES),
  trade: z.enum(TRADES).describe("The trade to call first."),
  urgency: z.enum(URGENCIES),
  respond_within: z.enum(RESPONSE_TIMES).describe("How soon a professional should look at it."),
  immediate_advice: z
    .string()
    .describe("1–2 sentences: what the owner should do right now to limit damage or stay safe, in the report language. Empty string if nothing."),
  item_key: z.enum(["none", ...ITEM_TEMPLATES.map((t) => t.key)] as [string, ...string[]]).describe("The checklist item the problem belongs to, or none."),
});

export type TriageOutput = z.infer<typeof TriageSchema>;
