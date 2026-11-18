import { AiError, analyzeInspectionItem } from "@/lib/ai";
import { getInspection, getItem } from "@/lib/repo";
import { fail, LOCKED, NOT_FOUND } from "@/lib/server/http";

// Vision analysis with thinking can take a while.
export const maxDuration = 300;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; itemKey: string }> }) {
  const { id, itemKey } = await ctx.params;
  const inspection = getInspection(id);
  if (!inspection) return fail(404, NOT_FOUND);
  if (inspection.status !== "capturing") return fail(409, LOCKED);
  if (!getItem(id, itemKey)) return fail(404, NOT_FOUND);

  try {
    const record = await analyzeInspectionItem(id, itemKey);
    return Response.json(record);
  } catch (err) {
    if (err instanceof AiError) {
      console.error(`[analyze] ${id}/${itemKey}: ${err.message}`);
      return fail(err.retryable ? 503 : 422, err.userMessage);
    }
    console.error(`[analyze] ${id}/${itemKey}`, err);
    return fail(500, { is: "Óvænt villa við greiningu.", en: "Unexpected error during analysis." });
  }
}
