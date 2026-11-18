import { AiError, verifyFix } from "@/lib/ai";
import { fail } from "@/lib/server/http";
import { loadForSeller } from "@/lib/server/negotiationAccess";

export const maxDuration = 300;

/** AI compares the inspection's BEFORE photos with the seller's AFTER photos. */
export async function POST(_req: Request, ctx: { params: Promise<{ token: string; findingId: string }> }) {
  const { token, findingId } = await ctx.params;
  const loaded = loadForSeller(token, findingId);
  if ("error" in loaded) return loaded.error;
  try {
    return Response.json(await verifyFix(loaded.bundle.inspection.id, findingId));
  } catch (err) {
    if (err instanceof AiError) {
      console.error(`[verify-fix] ${findingId}: ${err.message}`);
      return fail(err.retryable ? 503 : 422, err.userMessage);
    }
    console.error(`[verify-fix] ${findingId}`, err);
    return fail(500, { is: "Óvænt villa við samanburð.", en: "Unexpected error during comparison." });
  }
}
