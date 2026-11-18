import { z } from "zod";
import { createQuoteDrafts } from "@/lib/ownerRepo";
import { fail, readJson } from "@/lib/server/http";
import { finalReport, NOT_FINAL } from "@/lib/server/ownerAccess";

const Body = z.object({ findingIds: z.array(z.string().max(64)).min(1).max(60) });

/** Draft repair quotes from chosen findings: one per trade, reviewed and approved by a person. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const report = finalReport(id);
  if (!report || report.id !== id) return fail(409, NOT_FINAL);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, { is: "Veldu atriði fyrst.", en: "Choose items first." });
  const quotes = createQuoteDrafts(id, parsed.data.findingIds, report.lang);
  if (!quotes.length) return fail(400, { is: "Engin ný atriði til að gera tilboð í.", en: "No new items to quote." });
  return Response.json(quotes, { status: 201 });
}
