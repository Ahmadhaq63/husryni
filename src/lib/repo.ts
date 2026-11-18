import crypto from "node:crypto";
import { getDb } from "./db";
import { buildChecklist } from "./checklist";
import type {
  Confidence,
  Finding,
  FindingSource,
  FollowUp,
  Grade,
  Inspection,
  InspectionBundle,
  InspectionItem,
  InspectionStatus,
  InspectionSummaryAI,
  ItemAnalysisRecord,
  ItemStatus,
  Lang,
  Photo,
  PhotoSource,
  PropertyProfile,
  Purpose,
  ReviewStatus,
  Tier,
  Urgency,
} from "./types";

export const newId = (bytes = 16) => crypto.randomBytes(bytes).toString("base64url");
const now = () => new Date().toISOString();

// ---------------------------------------------------------------- mappers

type Row = Record<string, unknown>;

function toInspection(r: Row): Inspection {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    status: r.status as InspectionStatus,
    tier: r.tier as Tier,
    purpose: r.purpose as Purpose,
    lang: r.lang as Lang,
    address: r.address as string,
    postalCode: r.postal_code as string,
    fastanumer: (r.fastanumer as string | null) ?? null,
    propertyType: r.property_type as Inspection["propertyType"],
    buildYear: r.build_year as number,
    sizeM2: r.size_m2 as number,
    construction: r.construction as Inspection["construction"],
    heating: r.heating as Inspection["heating"],
    hasBasement: !!r.has_basement,
    hasAttic: !!r.has_attic,
    hasGarage: !!r.has_garage,
    hasFireplace: !!r.has_fireplace,
    hasHotTub: !!r.has_hot_tub,
    constructionStage: (r.construction_stage as Inspection["constructionStage"]) ?? null,
    contactName: r.contact_name as string,
    contactEmail: r.contact_email as string,
    priceIsk: (r.price_isk as number | null) ?? null,
    inspectorName: (r.inspector_name as string | null) ?? null,
    inspectorLicense: (r.inspector_license as string | null) ?? null,
    inspectorStatement: (r.inspector_statement as string | null) ?? null,
    signedAt: (r.signed_at as string | null) ?? null,
    summary: r.summary_json ? (JSON.parse(r.summary_json as string) as InspectionSummaryAI) : null,
  };
}

function toItem(r: Row): InspectionItem {
  return {
    id: r.id as number,
    inspectionId: r.inspection_id as string,
    itemKey: r.item_key as string,
    position: r.position as number,
    status: r.status as ItemStatus,
    notes: r.notes as string,
    notAccessible: !!r.not_accessible,
    analysis: r.analysis_json ? (JSON.parse(r.analysis_json as string) as ItemAnalysisRecord) : null,
  };
}

function toPhoto(r: Row): Photo {
  return {
    id: r.id as string,
    inspectionId: r.inspection_id as string,
    itemKey: r.item_key as string,
    source: r.source === "camera" ? "camera" : "upload",
    checkStatus: (r.check_status as Photo["checkStatus"]) ?? "unchecked",
    checkReason: (r.check_reason as string | null) ?? null,
    mime: r.mime as string,
    sizeBytes: r.size_bytes as number,
    createdAt: r.created_at as string,
  };
}

function toFinding(r: Row): Finding {
  return {
    id: r.id as string,
    inspectionId: r.inspection_id as string,
    itemKey: r.item_key as string,
    source: r.source as FindingSource,
    title: r.title as string,
    description: r.description as string,
    grade: r.grade as Grade,
    confidence: r.confidence as Confidence,
    photoIds: JSON.parse(r.photo_ids as string) as string[],
    recommendedAction: r.recommended_action as string,
    followUp: r.follow_up as FollowUp,
    urgency: r.urgency as Urgency,
    costKey: r.cost_key as string,
    reviewStatus: r.review_status as ReviewStatus,
    inspectorNote: r.inspector_note as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ---------------------------------------------------------------- inspections

export interface NewInspectionInput extends PropertyProfile {
  tier: Tier;
  purpose: Purpose;
  lang: Lang;
  address: string;
  postalCode: string;
  fastanumer: string | null;
  contactName: string;
  contactEmail: string;
  priceIsk: number | null;
  constructionStage?: Inspection["constructionStage"];
}

export function createInspection(input: NewInspectionInput): string {
  const db = getDb();
  const id = newId();
  const checklist = buildChecklist(input);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO inspections (id, created_at, status, tier, purpose, lang, address, postal_code, fastanumer,
        property_type, build_year, size_m2, construction, heating, has_basement, has_attic, contact_name, contact_email, price_isk,
        has_garage, has_fireplace, has_hot_tub, construction_stage)
       VALUES (@id, @createdAt, 'capturing', @tier, @purpose, @lang, @address, @postalCode, @fastanumer,
        @propertyType, @buildYear, @sizeM2, @construction, @heating, @hasBasement, @hasAttic, @contactName, @contactEmail, @priceIsk,
        @hasGarage, @hasFireplace, @hasHotTub, @constructionStage)`,
    ).run({
      ...input,
      id,
      createdAt: now(),
      hasBasement: input.hasBasement ? 1 : 0,
      hasAttic: input.hasAttic ? 1 : 0,
      hasGarage: input.hasGarage ? 1 : 0,
      hasFireplace: input.hasFireplace ? 1 : 0,
      hasHotTub: input.hasHotTub ? 1 : 0,
      constructionStage: input.constructionStage ?? null,
    });
    const insertItem = db.prepare("INSERT INTO items (inspection_id, item_key, position) VALUES (?, ?, ?)");
    checklist.forEach((t, i) => insertItem.run(id, t.key, i));
  })();
  return id;
}

export function getInspection(id: string): Inspection | null {
  const r = getDb().prepare("SELECT * FROM inspections WHERE id = ?").get(id) as Row | undefined;
  return r ? toInspection(r) : null;
}

export function getBundle(id: string): InspectionBundle | null {
  const inspection = getInspection(id);
  if (!inspection) return null;
  const db = getDb();
  const items = (db.prepare("SELECT * FROM items WHERE inspection_id = ? ORDER BY position").all(id) as Row[]).map(toItem);
  const photos = (db.prepare("SELECT * FROM photos WHERE inspection_id = ? ORDER BY created_at").all(id) as Row[]).map(toPhoto);
  const findings = (db.prepare("SELECT * FROM findings WHERE inspection_id = ? ORDER BY created_at").all(id) as Row[]).map(toFinding);
  return { inspection, items, photos, findings };
}

export function listInspections(statuses?: InspectionStatus[]): Inspection[] {
  const db = getDb();
  const rows = statuses?.length
    ? (db
        .prepare(`SELECT * FROM inspections WHERE status IN (${statuses.map(() => "?").join(",")}) ORDER BY created_at DESC`)
        .all(...statuses) as Row[])
    : (db.prepare("SELECT * FROM inspections ORDER BY created_at DESC").all() as Row[]);
  return rows.map(toInspection);
}

export function setStatus(id: string, status: InspectionStatus) {
  getDb().prepare("UPDATE inspections SET status = ? WHERE id = ?").run(status, id);
}

export function saveSummary(id: string, summary: InspectionSummaryAI) {
  getDb().prepare("UPDATE inspections SET summary_json = ? WHERE id = ?").run(JSON.stringify(summary), id);
}

export function signInspection(id: string, s: { name: string; license: string; statement: string }) {
  getDb()
    .prepare(
      "UPDATE inspections SET inspector_name = ?, inspector_license = ?, inspector_statement = ?, signed_at = ?, status = 'verified' WHERE id = ?",
    )
    .run(s.name, s.license, s.statement, now(), id);
}

// ---------------------------------------------------------------- items

export function getItem(inspectionId: string, itemKey: string): InspectionItem | null {
  const r = getDb().prepare("SELECT * FROM items WHERE inspection_id = ? AND item_key = ?").get(inspectionId, itemKey) as
    | Row
    | undefined;
  return r ? toItem(r) : null;
}

export function updateItem(inspectionId: string, itemKey: string, patch: { notes?: string; notAccessible?: boolean }) {
  const item = getItem(inspectionId, itemKey);
  if (!item) return null;
  const notes = patch.notes ?? item.notes;
  const notAccessible = patch.notAccessible ?? item.notAccessible;
  const db = getDb();
  db.transaction(() => {
    if (notAccessible && !item.notAccessible) {
      // "Not accessible" means not assessed: drop any earlier AI result so it can't leak into the report.
      db.prepare("DELETE FROM findings WHERE inspection_id = ? AND item_key = ? AND source = 'ai'").run(inspectionId, itemKey);
      db.prepare("UPDATE items SET analysis_json = NULL WHERE id = ?").run(item.id);
    }
    const status: ItemStatus = notAccessible ? "skipped" : item.status === "skipped" ? "pending" : item.status;
    db.prepare("UPDATE items SET notes = ?, not_accessible = ?, status = ? WHERE id = ?").run(notes, notAccessible ? 1 : 0, status, item.id);
  })();
  return getItem(inspectionId, itemKey);
}

/** Photos changed → previous analysis no longer reflects them. */
function markItemStale(inspectionId: string, itemKey: string) {
  getDb()
    .prepare("UPDATE items SET status = 'pending' WHERE inspection_id = ? AND item_key = ? AND status = 'analyzed'")
    .run(inspectionId, itemKey);
}

export interface NewFinding {
  title: string;
  description: string;
  grade: Grade;
  confidence: Confidence;
  photoIds: string[];
  recommendedAction: string;
  followUp: FollowUp;
  urgency: Urgency;
  costKey: string;
}

/** Replace the AI findings of one item with a fresh analysis (inspector-added findings are kept). */
export function saveItemAnalysis(inspectionId: string, itemKey: string, record: ItemAnalysisRecord, findings: NewFinding[]) {
  const db = getDb();
  db.transaction(() => {
    db.prepare("DELETE FROM findings WHERE inspection_id = ? AND item_key = ? AND source = 'ai'").run(inspectionId, itemKey);
    const ins = db.prepare(
      `INSERT INTO findings (id, inspection_id, item_key, source, title, description, grade, confidence, photo_ids,
        recommended_action, follow_up, urgency, cost_key, review_status, inspector_note, created_at, updated_at)
       VALUES (?, ?, ?, 'ai', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, ?)`,
    );
    const ts = now();
    for (const f of findings) {
      ins.run(
        newId(12),
        inspectionId,
        itemKey,
        f.title,
        f.description,
        f.grade,
        f.confidence,
        JSON.stringify(f.photoIds),
        f.recommendedAction,
        f.followUp,
        f.urgency,
        f.costKey,
        ts,
        ts,
      );
    }
    db.prepare("UPDATE items SET analysis_json = ?, status = 'analyzed', not_accessible = 0 WHERE inspection_id = ? AND item_key = ?").run(
      JSON.stringify(record),
      inspectionId,
      itemKey,
    );
  })();
}

// ---------------------------------------------------------------- photos

export function addPhoto(p: {
  id: string;
  inspectionId: string;
  itemKey: string;
  source: PhotoSource;
  mime: string;
  sizeBytes: number;
}): Photo {
  const createdAt = now();
  getDb()
    .prepare("INSERT INTO photos (id, inspection_id, item_key, source, mime, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(p.id, p.inspectionId, p.itemKey, p.source, p.mime, p.sizeBytes, createdAt);
  markItemStale(p.inspectionId, p.itemKey);
  return { ...p, createdAt, checkStatus: "unchecked", checkReason: null };
}

export function setPhotoCheck(photoId: string, status: Photo["checkStatus"], reason: string | null) {
  getDb().prepare("UPDATE photos SET check_status = ?, check_reason = ? WHERE id = ?").run(status, reason, photoId);
}

export function getPhoto(id: string): Photo | null {
  const r = getDb().prepare("SELECT * FROM photos WHERE id = ?").get(id) as Row | undefined;
  return r ? toPhoto(r) : null;
}

export function listItemPhotos(inspectionId: string, itemKey: string): Photo[] {
  return (
    getDb()
      .prepare("SELECT * FROM photos WHERE inspection_id = ? AND item_key = ? ORDER BY created_at")
      .all(inspectionId, itemKey) as Row[]
  ).map(toPhoto);
}

export function deletePhoto(id: string) {
  const photo = getPhoto(id);
  if (!photo) return;
  getDb().prepare("DELETE FROM photos WHERE id = ?").run(id);
  markItemStale(photo.inspectionId, photo.itemKey);
}

// ---------------------------------------------------------------- findings (inspector)

export function getFinding(id: string): Finding | null {
  const r = getDb().prepare("SELECT * FROM findings WHERE id = ?").get(id) as Row | undefined;
  return r ? toFinding(r) : null;
}

export interface FindingPatch {
  title?: string;
  description?: string;
  grade?: Grade;
  recommendedAction?: string;
  followUp?: FollowUp;
  urgency?: Urgency;
  costKey?: string;
  reviewStatus?: ReviewStatus;
  inspectorNote?: string;
}

export function updateFinding(id: string, patch: FindingPatch): Finding | null {
  const f = getFinding(id);
  if (!f) return null;
  const next = { ...f, ...patch };
  getDb()
    .prepare(
      `UPDATE findings SET title = ?, description = ?, grade = ?, recommended_action = ?, follow_up = ?, urgency = ?,
        cost_key = ?, review_status = ?, inspector_note = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      next.title,
      next.description,
      next.grade,
      next.recommendedAction,
      next.followUp,
      next.urgency,
      next.costKey,
      next.reviewStatus,
      next.inspectorNote,
      now(),
      id,
    );
  return getFinding(id);
}

export function addInspectorFinding(inspectionId: string, itemKey: string, f: NewFinding & { inspectorNote?: string }): Finding {
  const id = newId(12);
  const ts = now();
  getDb()
    .prepare(
      `INSERT INTO findings (id, inspection_id, item_key, source, title, description, grade, confidence, photo_ids,
        recommended_action, follow_up, urgency, cost_key, review_status, inspector_note, created_at, updated_at)
       VALUES (?, ?, ?, 'inspector', ?, ?, ?, 'high', ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`,
    )
    .run(
      id,
      inspectionId,
      itemKey,
      f.title,
      f.description,
      f.grade,
      JSON.stringify(f.photoIds),
      f.recommendedAction,
      f.followUp,
      f.urgency,
      f.costKey,
      f.inspectorNote ?? "",
      ts,
      ts,
    );
  return getFinding(id)!;
}

export function deleteFinding(id: string) {
  getDb().prepare("DELETE FROM findings WHERE id = ?").run(id);
}
