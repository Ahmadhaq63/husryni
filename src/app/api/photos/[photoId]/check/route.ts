import { checkPhoto } from "@/lib/ai";
import { getInspection, getPhoto } from "@/lib/repo";
import { fail, LOCKED, NOT_FOUND } from "@/lib/server/http";

export const maxDuration = 60;

/** Instant usability check of one inspection photo (fast model). Never blocks the user. */
export async function POST(_req: Request, ctx: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await ctx.params;
  const photo = getPhoto(photoId);
  if (!photo || photo.itemKey.startsWith("fix:")) return fail(404, NOT_FOUND);
  const inspection = getInspection(photo.inspectionId);
  if (!inspection || inspection.status !== "capturing") return fail(409, LOCKED);
  return Response.json(await checkPhoto(photoId));
}
