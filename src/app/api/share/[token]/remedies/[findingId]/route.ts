import { z } from "zod";
import { setSellerResponse } from "@/lib/negotiationRepo";
import { fail, readJson } from "@/lib/server/http";
import { loadForSeller } from "@/lib/server/negotiationAccess";
import { DISPUTE_REASONS, SELLER_RESPONSES } from "@/lib/types";

const Body = z
  .object({
    sellerResponse: z.enum(SELLER_RESPONSES),
    disputeReason: z.enum(DISPUTE_REASONS).nullable().optional(),
    sellerComment: z.string().trim().max(1000).optional(),
  })
  .refine((b) => b.sellerResponse !== "disputed" || !!b.disputeReason, { message: "dispute needs a reason" });

/** Seller accepts or disputes one requested item. */
export async function PUT(req: Request, ctx: { params: Promise<{ token: string; findingId: string }> }) {
  const { token, findingId } = await ctx.params;
  const loaded = loadForSeller(token, findingId);
  if ("error" in loaded) return loaded.error;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) {
    return fail(400, { is: "Veldu ástæðu fyrir mótmælum.", en: "Choose a reason for the dispute." });
  }
  return Response.json(
    setSellerResponse(findingId, {
      sellerResponse: parsed.data.sellerResponse,
      disputeReason: parsed.data.disputeReason ?? null,
      sellerComment: parsed.data.sellerComment ?? "",
    }),
  );
}
