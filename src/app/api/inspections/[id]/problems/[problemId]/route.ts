import { z } from "zod";
import { setProblemStatus } from "@/lib/ownerRepo";
import { fail, NOT_FOUND, readJson } from "@/lib/server/http";
import { finalReport, NOT_FINAL } from "@/lib/server/ownerAccess";

const Body = z.object({ status: z.enum(["open", "resolved"]) });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; problemId: string }> }) {
  const { id, problemId } = await ctx.params;
  const report = finalReport(id);
  if (!report) return fail(409, NOT_FINAL);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "invalid body");
  if (!setProblemStatus(report.id, problemId, parsed.data.status)) return fail(404, NOT_FOUND);
  return Response.json({ status: parsed.data.status });
}
