import { deleteFinding, getFinding, getInspection, updateFinding } from "@/lib/repo";
import { FindingPatchBody } from "@/lib/server/findingInput";
import { fail, LOCKED, NOT_FOUND, readJson, UNAUTHORIZED } from "@/lib/server/http";
import { isInspector } from "@/lib/server/session";
import type { Finding } from "@/lib/types";

type Loaded = { error: Response } | { finding: Finding };

function load(findingId: string): Loaded {
  const finding = getFinding(findingId);
  if (!finding) return { error: fail(404, NOT_FOUND) };
  const inspection = getInspection(finding.inspectionId);
  if (!inspection || inspection.status !== "in_review") return { error: fail(409, LOCKED) };
  return { finding };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ findingId: string }> }) {
  if (!(await isInspector())) return fail(401, UNAUTHORIZED);
  const { findingId } = await ctx.params;
  const loaded = load(findingId);
  if ("error" in loaded) return loaded.error;
  const { finding } = loaded;

  const parsed = FindingPatchBody.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "invalid body");
  const patch = parsed.data;

  // Content changes without an explicit status count as an inspector edit.
  const contentChanged = (Object.keys(patch) as (keyof typeof patch)[]).some(
    (k) => k !== "reviewStatus" && k !== "inspectorNote" && patch[k] !== undefined && patch[k] !== finding[k as keyof typeof finding],
  );
  const reviewStatus = patch.reviewStatus ?? (contentChanged ? "edited" : "confirmed");
  return Response.json(updateFinding(findingId, { ...patch, reviewStatus }));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ findingId: string }> }) {
  if (!(await isInspector())) return fail(401, UNAUTHORIZED);
  const { findingId } = await ctx.params;
  const loaded = load(findingId);
  if ("error" in loaded) return loaded.error;
  const { finding } = loaded;
  // AI findings are kept for the audit trail and can only be rejected.
  if (finding.source !== "inspector") return fail(400, { is: "Hafnaðu frekar athugasemd gervigreindar.", en: "Reject AI findings instead of deleting them." });
  deleteFinding(findingId);
  return new Response(null, { status: 204 });
}
