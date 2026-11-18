import { deletePhoto, getInspection, getPhoto } from "@/lib/repo";
import { fail, LOCKED, NOT_FOUND } from "@/lib/server/http";
import { deletePhotoFile, readPhotoFile } from "@/lib/storage";

// Photo ids are unguessable random tokens that only appear on pages already
// gated by the inspection link or inspector login (capability-URL model).

export async function GET(_req: Request, ctx: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await ctx.params;
  const photo = getPhoto(photoId);
  if (!photo) return fail(404, NOT_FOUND);
  try {
    const data = await readPhotoFile(photo.inspectionId, photo.id, photo.mime);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": photo.mime,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return fail(404, NOT_FOUND);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await ctx.params;
  const photo = getPhoto(photoId);
  if (!photo) return fail(404, NOT_FOUND);
  const inspection = getInspection(photo.inspectionId);
  if (!inspection || inspection.status !== "capturing") return fail(409, LOCKED);
  deletePhoto(photo.id);
  await deletePhotoFile(photo.inspectionId, photo.id, photo.mime);
  return new Response(null, { status: 204 });
}
