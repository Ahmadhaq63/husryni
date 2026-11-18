import { historyOpen, startAnnualCheck } from "@/lib/annualRepo";
import { getInspection } from "@/lib/repo";
import { fail, NOT_FOUND } from "@/lib/server/http";

/** Start the yearly owner check for a final report (or resume the one in progress). `id` is the report. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const report = getInspection(id);
  if (!report) return fail(404, NOT_FOUND);
  if (!historyOpen(report)) {
    return fail(409, { is: "Árleg skoðun hefst þegar skýrslan er tilbúin.", en: "The yearly check starts once the report is final." });
  }
  const annualId = startAnnualCheck(id);
  if (!annualId) return fail(409, NOT_FOUND);
  return Response.json({ id: annualId }, { status: 201 });
}
