import { fixItemKey, setFixStatus } from "@/lib/negotiationRepo";
import { addPhoto, listItemPhotos, newId } from "@/lib/repo";
import { fail } from "@/lib/server/http";
import { loadForSeller } from "@/lib/server/negotiationAccess";
import { MAX_UPLOAD_BYTES, savePhotoFile, sniffImageType } from "@/lib/storage";

const MAX_AFTER_PHOTOS = 6;

/** Seller uploads a photo taken after the repair. Any new photo invalidates the previous comparison. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string; findingId: string }> }) {
  const { token, findingId } = await ctx.params;
  const loaded = loadForSeller(token, findingId);
  if ("error" in loaded) return loaded.error;
  if (loaded.remedy!.action !== "seller_fix") {
    return fail(400, { is: "Aðeins er hægt að senda myndir fyrir lagfæringar seljanda.", en: "Photos can only be sent for seller repairs." });
  }
  const inspectionId = loaded.bundle.inspection.id;
  const key = fixItemKey(findingId);
  if (listItemPhotos(inspectionId, key).length >= MAX_AFTER_PHOTOS) {
    return fail(400, { is: `Hámark ${MAX_AFTER_PHOTOS} myndir.`, en: `At most ${MAX_AFTER_PHOTOS} photos.` });
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
  if (!mime) return fail(415, { is: "Aðeins JPEG, PNG eða WebP myndir.", en: "Only JPEG, PNG or WebP images." });

  const photoId = newId(12);
  await savePhotoFile(inspectionId, photoId, mime, data);
  const source = form.get("source") === "camera" ? "camera" : "upload";
  const photo = addPhoto({ id: photoId, inspectionId, itemKey: key, source, mime, sizeBytes: data.length });
  setFixStatus(findingId, "submitted", null);
  return Response.json(photo, { status: 201 });
}
