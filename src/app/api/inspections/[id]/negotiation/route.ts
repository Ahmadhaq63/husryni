import { z } from "zod";
import { updateNegotiation } from "@/lib/negotiationRepo";
import { fail, readJson } from "@/lib/server/http";
import { loadForBuyer } from "@/lib/server/negotiationAccess";

const Body = z.object({
  ownerSharePct: z.number().min(0).max(100).nullable().optional(),
  responseDeadline: z.iso.date().nullable().optional(),
  note: z.string().trim().max(2000).optional(),
});

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const loaded = loadForBuyer(id);
  if ("error" in loaded) return loaded.error;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "invalid body");
  return Response.json(updateNegotiation(id, parsed.data));
}
