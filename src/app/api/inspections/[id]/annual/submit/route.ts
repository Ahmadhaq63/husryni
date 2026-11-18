import { submitAnnualCheck } from "@/lib/annualRepo";
import { fail, LOCKED } from "@/lib/server/http";

/** Complete a yearly check. Problems become findings on the property's history. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = submitAnnualCheck(id);
  if (!r) return fail(409, LOCKED);
  if (!r.ok) {
    return Response.json(
      { error: { is: "Svaraðu öllum atriðum fyrst.", en: "Answer every item first." }, missing: r.missing },
      { status: 400 },
    );
  }
  return Response.json({ status: "ai_report" });
}
