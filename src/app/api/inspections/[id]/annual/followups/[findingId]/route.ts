import { z } from "zod";
import { setFollowUp } from "@/lib/annualRepo";
import { fail, LOCKED, readJson } from "@/lib/server/http";
import { FOLLOWUP_ANSWERS } from "@/lib/types";

const Body = z.object({
  answer: z.enum(FOLLOWUP_ANSWERS).nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

/** The owner's answer about one open finding in a yearly check. `id` is the yearly check. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; findingId: string }> }) {
  const { id, findingId } = await ctx.params;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "invalid body");
  const fu = setFollowUp(id, findingId, parsed.data);
  if (!fu) return fail(409, LOCKED);
  return Response.json(fu);
}
