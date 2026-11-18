import { deleteMoisture, getInspection, getMoisture } from "@/lib/repo";
import { fail, LOCKED, NOT_FOUND, UNAUTHORIZED } from "@/lib/server/http";
import { isInspector } from "@/lib/server/session";

export async function DELETE(_req: Request, ctx: { params: Promise<{ readingId: string }> }) {
  if (!(await isInspector())) return fail(401, UNAUTHORIZED);
  const { readingId } = await ctx.params;
  const reading = getMoisture(readingId);
  if (!reading) return fail(404, NOT_FOUND);
  if (getInspection(reading.inspectionId)?.status !== "in_review") return fail(409, LOCKED);
  deleteMoisture(readingId);
  return new Response(null, { status: 204 });
}
