import { getQuestion } from "@/lib/annual";
import { getFollowUp, photosChanged } from "@/lib/annualRepo";
import { addPhoto, getInspection, listItemPhotos, newId } from "@/lib/repo";
import { fail, LOCKED, NOT_FOUND } from "@/lib/server/http";
import { MAX_UPLOAD_BYTES, savePhotoFile, sniffImageType } from "@/lib/storage";

const MAX_PHOTOS_PER_KEY = 4;

/** A photo for a yearly check: key "fu:<findingId>" (a follow-up) or "q:<questionId>" (a question). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const check = getInspection(id);
  if (!check || check.kind !== "annual") return fail(404, NOT_FOUND);
  if (check.status !== "capturing") return fail(409, LOCKED);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "expected multipart form data");
  }
  const key = String(form.get("key") ?? "");
  const valid =
    (key.startsWith("fu:") && !!getFollowUp(id, key.slice(3))) || (key.startsWith("q:") && !!getQuestion(key.slice(2)));
  if (!valid) return fail(400, "unknown photo key");
  if (listItemPhotos(id, key).length >= MAX_PHOTOS_PER_KEY) {
    return fail(400, { is: `Hámark ${MAX_PHOTOS_PER_KEY} myndir.`, en: `At most ${MAX_PHOTOS_PER_KEY} photos.` });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "missing file");
  if (file.size > MAX_UPLOAD_BYTES) return fail(413, { is: "Myndin er of stór.", en: "The image is too large." });
  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageType(data);
  if (!mime) return fail(415, { is: "Aðeins JPEG, PNG eða WebP myndir eru studdar.", en: "Only JPEG, PNG or WebP images are supported." });

  const photoId = newId(12);
  await savePhotoFile(id, photoId, mime, data);
  const photo = addPhoto({ id: photoId, inspectionId: id, itemKey: key, source: form.get("source") === "camera" ? "camera" : "upload", mime, sizeBytes: data.length });
  photosChanged(id, key);
  return Response.json(photo, { status: 201 });
}
