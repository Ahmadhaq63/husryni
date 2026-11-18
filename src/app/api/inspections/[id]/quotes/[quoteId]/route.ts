import { z } from "zod";
import { deleteQuote, updateQuote } from "@/lib/ownerRepo";
import { QUOTE_STATUSES } from "@/lib/ownerTools";
import { fail, LOCKED, NOT_FOUND, readJson } from "@/lib/server/http";

const Line = z.object({
  description: z.string().trim().min(1).max(200),
  qty: z.number().min(0).max(10_000),
  unit: z.string().trim().max(20),
  unitPrice: z.number().min(0).max(100_000_000),
});
const Body = z.object({ lines: z.array(Line).max(60).optional(), status: z.enum(QUOTE_STATUSES).optional() });

/** Edit a draft's lines, mark it sent, or approve it (approval locks the quote). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; quoteId: string }> }) {
  const { id, quoteId } = await ctx.params;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, { is: "Athugaðu línurnar (lýsing, magn, verð).", en: "Check the lines (description, quantity, price)." });
  const q = updateQuote(id, quoteId, parsed.data);
  if (!q) return fail(409, LOCKED);
  return Response.json(q);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; quoteId: string }> }) {
  const { id, quoteId } = await ctx.params;
  if (!deleteQuote(id, quoteId)) return fail(404, NOT_FOUND);
  return new Response(null, { status: 204 });
}
