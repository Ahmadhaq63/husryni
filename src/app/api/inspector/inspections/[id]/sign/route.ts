import { z } from "zod";
import { generateSummary } from "@/lib/ai";
import { feeForTier } from "@/lib/pricing";
import { getBundle, sealInspection, setReportHash } from "@/lib/repo";
import { buildReport } from "@/lib/report";
import { computeSeal, type SealFields } from "@/lib/seal";
import { missingCauseOrConsequence, STANDARD_VERSION } from "@/lib/standard";
import { fail, LOCKED, NOT_FOUND, readJson, UNAUTHORIZED } from "@/lib/server/http";
import { isInspector } from "@/lib/server/session";
import type { InspectionBundle } from "@/lib/types";

export const maxDuration = 120;

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  license: z.string().trim().min(1).max(60),
  statement: z.string().trim().min(10).max(2000),
  /** Independence declaration: no interest in the sale, and a fixed fee whatever the result. */
  declaration: z.literal(true),
});

/** Why a report can't be signed yet, or null. */
function notReady(bundle: InspectionBundle): Response | null {
  // "AI recommends, inspector decides": every AI finding needs an explicit decision.
  const unreviewed = bundle.findings.filter((f) => f.reviewStatus === "pending").length;
  if (unreviewed > 0) {
    return fail(400, {
      is: `Fara þarf yfir ${unreviewed} athugasemdir gervigreindar áður en undirritað er.`,
      en: `Review ${unreviewed} AI findings before signing.`,
    });
  }
  // The standard: every TG2/TG3 finding states its cause and its consequence.
  const incomplete = bundle.findings.filter(missingCauseOrConsequence).length;
  if (incomplete > 0) {
    return fail(400, {
      is: `${incomplete} ${incomplete === 1 ? "athugasemd" : "athugasemdir"} á TG2/TG3 vantar orsök eða afleiðingu.`,
      en: `${incomplete} TG2/TG3 ${incomplete === 1 ? "finding needs" : "findings need"} a cause and a consequence.`,
    });
  }
  return null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isInspector())) return fail(401, UNAUTHORIZED);
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await readJson(req));
  const bundle = getBundle(id);
  if (!bundle) return fail(404, NOT_FOUND);
  if (bundle.inspection.status !== "in_review") return fail(409, LOCKED);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "declaration")) {
      return fail(400, { is: "Staðfestu hagsmunayfirlýsinguna áður en þú undirritar.", en: "Confirm the declaration of interests before signing." });
    }
    return fail(400, { is: "Fylltu út nafn, starfsleyfi og yfirlýsingu.", en: "Fill in name, licence and statement." });
  }
  const early = notReady(bundle);
  if (early) return early;

  const at = new Date().toISOString();
  const { declaration: _declared, ...signature } = parsed.data;
  const base = { ...signature, signedAt: at, declaredAt: at, feeIsk: feeForTier(bundle.inspection.tier), standardVersion: STANDARD_VERSION };
  // Catch an unreadable photo before anything is locked.
  try {
    await computeSeal(bundle, { ...base, overallGrade: "TG0" });
  } catch (err) {
    console.error(`[sign] seal precheck failed for ${id}`, err);
    return fail(500, { is: "Ekki tókst að innsigla skýrsluna (mynd vantar?).", en: "Could not seal the report (a photo is missing?)." });
  }

  // Rebuild the summary from the reviewed findings; a failure keeps the earlier draft summary.
  try {
    await generateSummary(id);
  } catch (err) {
    console.error(`[sign] summary failed for ${id}`, err);
  }

  // From here to the lock there is no await, so no other request can run in between (one JS thread):
  // check the report again as it is now, compute the grade from it, and lock it.
  const current = getBundle(id);
  if (!current || current.inspection.status !== "in_review") return fail(409, LOCKED);
  const late = notReady(current);
  if (late) return late;
  const fields: SealFields = { ...base, overallGrade: buildReport(current).overall.grade };
  if (!sealInspection(id, { ...fields, reportHash: null })) return fail(409, LOCKED);

  // Locked: every edit route refuses a verified report, so this is the report as signed. Seal it.
  try {
    const seal = await computeSeal(getBundle(id)!, fields);
    setReportHash(id, seal);
    return Response.json({ status: "verified", seal });
  } catch (err) {
    console.error(`[sign] seal failed for ${id} after locking`, err);
    return Response.json({ status: "verified", seal: null });
  }
}
