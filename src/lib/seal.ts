import crypto from "node:crypto";
import { getBundle } from "./repo";
import { canonicalJson } from "./standard";
import { photoFileStat, readPhotoFile } from "./storage";
import type { Grade, Inspection, InspectionBundle } from "./types";

/**
 * The report seal: a SHA-256 fingerprint over everything that makes up a signed report, the bytes of
 * every photo included. It is computed on the server when the inspector signs and stored with the report;
 * the verification page recomputes it from what is stored now, so any later change to the report, its
 * findings, readings or photos shows up as "changed". (Tamper evidence, not a qualified e-signature.)
 */

export interface SealFields {
  name: string;
  license: string;
  statement: string;
  signedAt: string;
  declaredAt: string;
  feeIsk: number | null;
  standardVersion: string;
  overallGrade: Grade;
}

const sha256 = (data: string | Buffer) => crypto.createHash("sha256").update(data).digest("hex");

// Hashing photos is the expensive part of a check (the public /verify page runs one per request): remember each
// photo's hash by its size and modification time, so any change to the file is still hashed again.
const photoHashes = new Map<string, string>();
async function photoHash(inspectionId: string, photoId: string, mime: string): Promise<string> {
  const st = await photoFileStat(inspectionId, photoId, mime);
  const key = `${inspectionId}/${photoId}:${st.size}:${st.mtimeMs}`;
  const known = photoHashes.get(key);
  if (known) return known;
  const hash = sha256(await readPhotoFile(inspectionId, photoId, mime));
  if (photoHashes.size > 5000) photoHashes.clear();
  photoHashes.set(key, hash);
  return hash;
}
const byKey = <T>(key: (x: T) => string) => (a: T, b: T) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);

/** What the seal covers. Arrays are sorted so the same report always gives the same bytes. */
export async function reportSnapshot(bundle: InspectionBundle, sig: SealFields) {
  const i = bundle.inspection;
  // Only the checklist's own photos: photos added later for other purposes (the seller's repair photos in the
  // negotiation, "fix:<findingId>") are not part of the signed report and must not break its seal.
  const itemKeys = new Set(bundle.items.map((it) => it.itemKey));
  const photos = await Promise.all(
    bundle.photos.filter((p) => itemKeys.has(p.itemKey)).map(async (p) => ({
      id: p.id,
      itemKey: p.itemKey,
      mime: p.mime,
      source: p.source,
      sha256: await photoHash(i.id, p.id, p.mime),
    })),
  );
  return {
    seal: 1,
    property: {
      id: i.id,
      address: i.address,
      postalCode: i.postalCode,
      fastanumer: i.fastanumer,
      propertyType: i.propertyType,
      buildYear: i.buildYear,
      sizeM2: i.sizeM2,
      construction: i.construction,
      heating: i.heating,
      hasBasement: i.hasBasement,
      hasAttic: i.hasAttic,
      hasGarage: !!i.hasGarage,
      hasFireplace: !!i.hasFireplace,
      hasHotTub: !!i.hasHotTub,
      constructionStage: i.constructionStage,
      priceIsk: i.priceIsk,
    },
    order: { tier: i.tier, purpose: i.purpose, lang: i.lang, createdAt: i.createdAt },
    signature: sig,
    summary: i.summary ? { overall: i.summary.overall, keyRisks: i.summary.keyRisks, advice: i.summary.advice } : null,
    items: bundle.items
      .map((it) => ({
        key: it.itemKey,
        status: it.status,
        notAccessible: it.notAccessible,
        naReason: it.naReason,
        notes: it.notes,
        itemSummary: it.analysis?.itemSummary ?? null,
        engine: it.analysis?.engine ?? null,
      }))
      .sort(byKey((x) => x.key)),
    findings: bundle.findings
      .map((f) => ({
        id: f.id,
        itemKey: f.itemKey,
        source: f.source,
        title: f.title,
        description: f.description,
        cause: f.cause,
        consequence: f.consequence,
        grade: f.grade,
        aiGrade: f.aiGrade,
        confidence: f.confidence,
        urgency: f.urgency,
        followUp: f.followUp,
        costKey: f.costKey,
        recommendedAction: f.recommendedAction,
        reviewStatus: f.reviewStatus,
        inspectorNote: f.inspectorNote,
        photoIds: f.photoIds,
      }))
      .sort(byKey((x) => x.id)),
    moisture: bundle.moisture
      .map((m) => ({ id: m.id, itemKey: m.itemKey, room: m.room, part: m.part, value: m.value, method: m.method }))
      .sort(byKey((x) => x.id)),
    photos: photos.sort(byKey((x) => x.id)),
  };
}

export async function computeSeal(bundle: InspectionBundle, sig: SealFields): Promise<string> {
  return sha256(canonicalJson(await reportSnapshot(bundle, sig)));
}

/** The signature fields exactly as they were stored at signing. */
export function storedSealFields(i: Inspection): SealFields | null {
  if (!i.reportHash || !i.signedAt || !i.declaredAt || !i.standardVersion || !i.overallGrade) return null;
  return {
    name: i.inspectorName ?? "",
    license: i.inspectorLicense ?? "",
    statement: i.inspectorStatement ?? "",
    signedAt: i.signedAt,
    declaredAt: i.declaredAt,
    feeIsk: i.feeIsk,
    standardVersion: i.standardVersion,
    overallGrade: i.overallGrade,
  };
}

export type SealStatus = "intact" | "changed" | "unsealed";

/** Recompute the seal from what is stored now and compare it with the one made at signing. */
export async function checkSeal(id: string): Promise<{ status: SealStatus; bundle: InspectionBundle } | null> {
  const bundle = getBundle(id);
  if (!bundle) return null;
  const fields = storedSealFields(bundle.inspection);
  if (!fields) return { status: "unsealed", bundle };
  try {
    const now = await computeSeal(bundle, fields);
    return { status: now === bundle.inspection.reportHash ? "intact" : "changed", bundle };
  } catch {
    // A photo file that is gone or unreadable is a change too.
    return { status: "changed", bundle };
  }
}
