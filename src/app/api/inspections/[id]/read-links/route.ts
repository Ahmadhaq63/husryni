import { z } from "zod";
import { createReadLink, listReadLinks } from "@/lib/ownerRepo";
import { AUDIENCES } from "@/lib/ownerTools";
import { fail, readJson } from "@/lib/server/http";
import { finalReport, NOT_FINAL } from "@/lib/server/ownerAccess";

const Body = z.object({ audience: z.enum(AUDIENCES), label: z.string().trim().max(80).default("") });

/** The owner gives someone (an insurer, a bank) read-only access to the report, which they can revoke later. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const report = finalReport(id);
  if (!report || report.id !== id) return fail(409, NOT_FINAL);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "invalid body");
  if (listReadLinks(id).filter((l) => !l.revokedAt).length >= 20) {
    return fail(400, { is: "Of margir virkir tenglar. Afturkallaðu einhverja fyrst.", en: "Too many active links. Revoke some first." });
  }
  return Response.json(createReadLink(id, parsed.data.audience, parsed.data.label), { status: 201 });
}
