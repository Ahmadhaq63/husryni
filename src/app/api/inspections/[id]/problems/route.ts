import { z } from "zod";
import { AiError, triageProblem } from "@/lib/ai";
import { addProblem, deleteProblem, listProblems, setProblemTriage } from "@/lib/ownerRepo";
import { fail, readJson } from "@/lib/server/http";
import { finalReport, NOT_FINAL } from "@/lib/server/ownerAccess";

export const maxDuration = 60;

const Body = z.object({ text: z.string().trim().min(3).max(1000) });

/** The owner reports a problem between checks: triaged (trade, urgency, what to do now) and logged on the history. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const report = finalReport(id);
  if (!report) return fail(409, NOT_FINAL);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, { is: "Lýstu vandanum í nokkrum orðum.", en: "Describe the problem in a few words." });
  if (listProblems(report.id).filter((p) => Date.parse(p.createdAt) > Date.now() - 86_400_000).length >= 20) {
    return fail(429, { is: "Of margar tilkynningar í dag.", en: "Too many reports today." });
  }
  // Record it before the model call (no await in between), so parallel requests can't pass the cap.
  const problem = addProblem(report.id, parsed.data.text);
  try {
    const triage = await triageProblem(report.id, parsed.data.text);
    return Response.json(setProblemTriage(problem.id, triage), { status: 201 });
  } catch (err) {
    deleteProblem(problem.id);
    if (err instanceof AiError) return fail(err.retryable ? 503 : 400, err.userMessage);
    console.error(`[problems] ${id}`, err);
    return fail(500, { is: "Ekki tókst að skrá vandann. Reyndu aftur.", en: "Could not record the problem. Try again." });
  }
}
