import { AiError, checkFollowUp } from "@/lib/ai";
import { followUpTarget } from "@/lib/annualRepo";
import { fail, LOCKED, NOT_FOUND } from "@/lib/server/http";

export const maxDuration = 120;

/** Compare the report's photos of the finding with the owner's new photos (AI, or the demo analyser). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; findingId: string }> }) {
  const { id, findingId } = await ctx.params;
  const target = followUpTarget(id, findingId);
  if (!target) return fail(404, NOT_FOUND);
  if (target.annual.status !== "capturing") return fail(409, LOCKED);
  try {
    return Response.json(await checkFollowUp(id, findingId));
  } catch (err) {
    if (err instanceof AiError) return fail(err.retryable ? 503 : 400, err.userMessage);
    console.error(`[followup-check] ${id}/${findingId}`, err);
    return fail(500, { is: "Samanburður mistókst. Reyndu aftur.", en: "The comparison failed. Try again." });
  }
}
