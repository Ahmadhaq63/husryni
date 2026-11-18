import { addInspectorFinding, getInspection, getItem, listItemPhotos } from "@/lib/repo";
import { NewFindingBody } from "@/lib/server/findingInput";
import { fail, LOCKED, NOT_FOUND, readJson, UNAUTHORIZED } from "@/lib/server/http";
import { isInspector } from "@/lib/server/session";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isInspector())) return fail(401, UNAUTHORIZED);
  const { id } = await ctx.params;
  // Body first: from the status check to the write there must be no await, or a signing could slip in between.
  const body = await readJson(req);
  const inspection = getInspection(id);
  if (!inspection) return fail(404, NOT_FOUND);
  if (inspection.status !== "in_review") return fail(409, LOCKED);

  const parsed = NewFindingBody.safeParse(body);
  if (!parsed.success) return fail(400, "invalid body");
  const { itemKey, photoIds, ...rest } = parsed.data;
  if (!getItem(id, itemKey)) return fail(404, NOT_FOUND);

  const itemPhotoIds = new Set(listItemPhotos(id, itemKey).map((p) => p.id));
  const finding = addInspectorFinding(id, itemKey, {
    ...rest,
    confidence: "high",
    photoIds: photoIds.filter((p) => itemPhotoIds.has(p)),
  });
  return Response.json(finding, { status: 201 });
}
