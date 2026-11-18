import { z } from "zod";
import { createInspection } from "@/lib/repo";
import { fail, readJson } from "@/lib/server/http";
import { CONSTRUCTION_STAGES, CONSTRUCTION_TYPES, HEATING_TYPES, PROPERTY_TYPES, PURPOSES, TIERS } from "@/lib/types";

const CreateBody = z.object({
  address: z.string().trim().min(3).max(200),
  postalCode: z.string().trim().regex(/^\d{3}$/),
  fastanumer: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s-]/g, "").toUpperCase())
    .refine((s) => s === "" || /^F?\d{7}$/.test(s))
    .transform((s) => (s === "" ? null : s.startsWith("F") ? s : `F${s}`))
    .nullable()
    .optional(),
  propertyType: z.enum(PROPERTY_TYPES),
  buildYear: z.coerce
    .number()
    .int()
    .min(1850)
    .max(new Date().getFullYear() + 1),
  sizeM2: z.coerce.number().min(10).max(2000),
  construction: z.enum(CONSTRUCTION_TYPES),
  heating: z.enum(HEATING_TYPES),
  hasBasement: z.boolean(),
  hasAttic: z.boolean(),
  hasGarage: z.boolean().optional(),
  hasFireplace: z.boolean().optional(),
  hasHotTub: z.boolean().optional(),
  constructionStage: z.enum(CONSTRUCTION_STAGES).nullable().optional(),
  purpose: z.enum(PURPOSES),
  tier: z.enum(TIERS),
  lang: z.enum(["is", "en"]),
  contactName: z.string().trim().min(2).max(120),
  contactEmail: z.email().max(200),
  priceIsk: z.number().int().min(1_000_000).max(5_000_000_000).nullable().optional(),
  consent: z.literal(true),
});

export async function POST(req: Request) {
  const parsed = CreateBody.safeParse(await readJson(req));
  if (!parsed.success) {
    return Response.json(
      {
        error: { is: "Vinsamlega yfirfarðu reitina.", en: "Please check the form fields." },
        fields: parsed.error.issues.map((i) => i.path.join(".")),
      },
      { status: 400 },
    );
  }
  const { consent: _consent, fastanumer, priceIsk, ...rest } = parsed.data;
  if (!_consent) return fail(400, "consent required");
  const id = createInspection({ ...rest, fastanumer: fastanumer ?? null, priceIsk: priceIsk ?? null });
  return Response.json({ id }, { status: 201 });
}
