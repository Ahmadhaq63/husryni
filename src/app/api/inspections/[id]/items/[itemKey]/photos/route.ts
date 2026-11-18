import { addPhoto, getInspection, getItem, listItemPhotos, newId } from "@/lib/repo";
import { fail, LOCKED, NOT_FOUND } from "@/lib/server/http";
import { MAX_UPLOAD_BYTES, savePhotoFile, sniffImageType } from "@/lib/storage";

const MAX_PHOTOS_PER_ITEM = 8;

export async function POST(req: Request, ctx: { params: Promise<{ id: string; itemKey: string }> }) {
  const { id, itemKey } = await ctx.params;
  const inspection = getInspection(id);
  if (!inspection) return fail(404, NOT_FOUND);
  if (inspection.status !== "capturing") return fail(409, LOCKED);
  if (!getItem(id, itemKey)) return fail(404, NOT_FOUND);
  if (listItemPhotos(id, itemKey).length >= MAX_PHOTOS_PER_ITEM) {
    return fail(400, {
      is: `Hámark ${MAX_PHOTOS_PER_ITEM} myndir á hvern lið.`,
      en: `At most ${MAX_PHOTOS_PER_ITEM} photos per item.`,
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "expected multipart form data");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "missing file");
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, { is: "Myndin er of stór.", en: "The image is too large." });

  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageType(data);
  if (!mime) {
    return fail(415, {
      is: "Aðeins JPEG, PNG eða WebP myndir eru studdar.",
      en: "Only JPEG, PNG or WebP images are supported.",
    });
  }

  const photoId = newId(12);
  await savePhotoFile(id, photoId, mime, data);
  // Self-declared by the client (camera input vs library picker). Not tamper-proof: a native app
  // with on-device capture is the stronger version of this signal.
  const source = form.get("source") === "camera" ? "camera" : "upload";
  const photo = addPhoto({ id: photoId, inspectionId: id, itemKey, source, mime, sizeBytes: data.length });
  return Response.json(photo, { status: 201 });
}
