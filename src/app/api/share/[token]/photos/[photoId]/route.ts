import { fixItemKey, getNegotiationByToken, setFixStatus } from "@/lib/negotiationRepo";
import { deletePhoto, getPhoto, listItemPhotos } from "@/lib/repo";
import { fail, NOT_FOUND } from "@/lib/server/http";
import { deletePhotoFile } from "@/lib/storage";

/** Seller removes one of their own after-repair photos. Inspection photos can never be touched from here. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await ctx.params;
  const negotiation = getNegotiationByToken(token);
  const photo = getPhoto(photoId);
  if (!negotiation || !photo || photo.inspectionId !== negotiation.inspectionId || !photo.itemKey.startsWith("fix:")) {
    return fail(404, NOT_FOUND);
  }
  deletePhoto(photo.id);
  await deletePhotoFile(photo.inspectionId, photo.id, photo.mime);
  const findingId = photo.itemKey.slice("fix:".length);
  setFixStatus(findingId, listItemPhotos(photo.inspectionId, fixItemKey(findingId)).length ? "submitted" : "none", null);
  return new Response(null, { status: 204 });
}
