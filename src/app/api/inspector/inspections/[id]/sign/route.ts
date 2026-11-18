import { z } from "zod";
import { generateSummary } from "@/lib/ai";
import { getBundle, signInspection } from "@/lib/repo";
import { fail, LOCKED, NOT_FOUND, readJson, UNAUTHORIZED } from "@/lib/server/http";
import { isInspector } from "@/lib/server/session";

export const maxDuration = 120;

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  license: z.string().trim().min(1).max(60),
  statement: z.string().trim().min(10).max(2000),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isInspector())) return fail(401, UNAUTHORIZED);
  const { id } = await ctx.params;
  const bundle = getBundle(id);
  if (!bundle) return fail(404, NOT_FOUND);
  if (bundle.inspection.status !== "in_review") return fail(409, LOCKED);

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, { is: "Fylltu út nafn, starfsleyfi og yfirlýsingu.", en: "Fill in name, licence and statement." });

  // "AI recommends, inspector decides": every AI finding needs an explicit decision.
  const unreviewed = bundle.findings.filter((f) => f.reviewStatus === "pending").length;
  if (unreviewed > 0) {
    return fail(400, {
      is: `Fara þarf yfir ${unreviewed} athugasemdir gervigreindar áður en undirritað er.`,
      en: `Review ${unreviewed} AI findings before signing.`,
    });
  }

  // Rebuild the summary from the reviewed findings; a failure keeps the earlier draft summary.
  try {
    await generateSummary(id);
  } catch (err) {
    console.error(`[sign] summary failed for ${id}`, err);
  }
  signInspection(id, parsed.data);
  return Response.json({ status: "verified" });
}
