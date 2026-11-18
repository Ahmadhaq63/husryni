import { generateSummary } from "@/lib/ai";
import { getBundle, setStatus } from "@/lib/repo";
import { readyToSubmit } from "@/lib/report";
import { fail, LOCKED, NOT_FOUND } from "@/lib/server/http";

export const maxDuration = 120;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const bundle = getBundle(id);
  if (!bundle) return fail(404, NOT_FOUND);
  if (bundle.inspection.status !== "capturing") return fail(409, LOCKED);

  const ready = readyToSubmit(bundle);
  if (!ready.ok) {
    return Response.json(
      {
        error: { is: "Enn eru liðir óunnir.", en: "Some items are still open." },
        missing: ready.missing,
      },
      { status: 400 },
    );
  }

  // The summary is helpful but not essential: a failure must not block submission.
  try {
    await generateSummary(id);
  } catch (err) {
    console.error(`[submit] summary failed for ${id}`, err);
  }

  const status = bundle.inspection.tier === "verified" ? "in_review" : "ai_report";
  setStatus(id, status);
  return Response.json({ status });
}
