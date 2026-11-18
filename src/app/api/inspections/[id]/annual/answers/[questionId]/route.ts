import { z } from "zod";
import { setAnswer } from "@/lib/annualRepo";
import { fail, LOCKED, readJson } from "@/lib/server/http";
import { QUESTION_ANSWERS } from "@/lib/types";

const Body = z.object({
  answer: z.enum(QUESTION_ANSWERS).nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

/** The owner's answer to one of the yearly questions. `id` is the yearly check. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; questionId: string }> }) {
  const { id, questionId } = await ctx.params;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "invalid body");
  const a = setAnswer(id, questionId, parsed.data);
  if (!a) return fail(409, LOCKED);
  return Response.json(a);
}
