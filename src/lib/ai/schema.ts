import { z } from "zod";
import { CONFIDENCES, FIX_VERDICTS, FOLLOW_UPS, GRADES, URGENCIES } from "../types";
import { COST_KEYS } from "../costs";

const COST_KEY_ENUM = ["none", ...COST_KEYS] as [string, ...string[]];

export const FindingSchema = z.object({
  title: z.string().describe("Short name of the issue (max ~8 words), in the report language."),
  description: z.string().describe("What is visible and why it matters, 1–3 sentences, in the report language."),
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
