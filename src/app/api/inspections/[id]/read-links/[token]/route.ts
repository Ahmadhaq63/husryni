import { revokeReadLink } from "@/lib/ownerRepo";
import { fail, NOT_FOUND } from "@/lib/server/http";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await ctx.params;
  if (!revokeReadLink(id, token)) return fail(404, NOT_FOUND);
  return new Response(null, { status: 204 });
}
