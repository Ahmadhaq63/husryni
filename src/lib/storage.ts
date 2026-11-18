import fs from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./db";

/**
 * Local-disk photo storage for the prototype. In production swap this for
 * EU-hosted object storage (e.g. Azure Blob in North Europe) with the same API.
 */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // client resizes to ~2000px, so real uploads are far smaller

const EXT: Record<AllowedImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function isAllowedImageType(mime: string): mime is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mime);
}

/** Check magic bytes so a renamed file can't masquerade as an image. */
export function sniffImageType(buf: Buffer): AllowedImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  return null;
}

function photoPath(inspectionId: string, photoId: string, mime: AllowedImageType) {
  // ids are base64url (no path separators) — still, never trust them blindly
  if (!/^[A-Za-z0-9_-]+$/.test(inspectionId) || !/^[A-Za-z0-9_-]+$/.test(photoId)) throw new Error("bad id");
  return path.join(dataDir(), "uploads", inspectionId, `${photoId}.${EXT[mime]}`);
}

export async function savePhotoFile(inspectionId: string, photoId: string, mime: AllowedImageType, data: Buffer) {
  const p = photoPath(inspectionId, photoId, mime);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
}

export async function readPhotoFile(inspectionId: string, photoId: string, mime: string): Promise<Buffer> {
  if (!isAllowedImageType(mime)) throw new Error("unsupported type");
  return fs.readFile(photoPath(inspectionId, photoId, mime));
}

export async function deletePhotoFile(inspectionId: string, photoId: string, mime: string) {
  if (!isAllowedImageType(mime)) return;
  await fs.rm(photoPath(inspectionId, photoId, mime), { force: true });
}
