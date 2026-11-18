import { z } from "zod";
import { hasOwnersAssociation } from "@/lib/negotiation";
import { ensureNegotiation, setRemedyAction } from "@/lib/negotiationRepo";
import { fail, NOT_FOUND, readJson } from "@/lib/server/http";
import { loadForBuyer, negotiableFinding } from "@/lib/server/negotiationAccess";
import { REMEDY_ACTIONS } from "@/lib/types";

const Body = z.object({
  action: z.enum(REMEDY_ACTIONS),
  amountIsk: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  remark: z.string().trim().max(1000).optional(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string; findingId: string }> }) {
  const { id, findingId } = await ctx.params;
  const loaded = loadForBuyer(id);
  if ("error" in loaded) return loaded.error;
  if (!negotiableFinding(loaded.bundle, findingId)) return fail(404, NOT_FOUND);

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "invalid body");
  if (parsed.data.action === "hoa" && !hasOwnersAssociation(loaded.bundle.inspection.propertyType)) {
    return fail(400, { is: "Þessi eign er ekki með húsfélag.", en: "This property has no owners' association." });
  }
  ensureNegotiation(id);
  return Response.json(setRemedyAction(id, findingId, parsed.data));
}
