/**
 * Downscale a photo in the browser before upload.
 * - keeps uploads small on mobile data (≈300–700 KB instead of 3–8 MB)
 * - re-encoding through a canvas strips EXIF metadata such as GPS position
 * - 2000 px on the long edge keeps detail for cracks and stains while capping
 *   vision token cost (the model accepts up to 2576 px)
 */
export async function resizeForUpload(file: File, maxEdge = 2000, quality = 0.85): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Browser can't decode it (e.g. HEIC on desktop) — send as-is and let the server decide.
    return file;
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
}
