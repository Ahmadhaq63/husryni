import { z } from "zod";
import { getInspection, updateItem } from "@/lib/repo";
import { fail, LOCKED, NOT_FOUND, readJson } from "@/lib/server/http";

const PatchBody = z.object({
  notes: z.string().max(2000).optional(),
  notAccessible: z.boolean().optional(),
  /** Why the item can't be assessed (required before submitting when notAccessible). */
  naReason: z.string().trim().max(500).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; itemKey: string }> }) {
  const { id, itemKey } = await ctx.params;
  const inspection = getInspection(id);
  if (!inspection) return fail(404, NOT_FOUND);
  if (inspection.status !== "capturing") return fail(409, LOCKED);
  const parsed = PatchBody.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "invalid body");
  const item = updateItem(id, itemKey, parsed.data);
  if (!item) return fail(404, NOT_FOUND);
  return Response.json(item);
}
