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
  MoistureReading,
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
    standardVersion: (r.standard_version as string | null) ?? null,
    overallGrade: (r.overall_grade as Grade | null) ?? null,
    feeIsk: (r.fee_isk as number | null) ?? null,
    declaredAt: (r.declared_at as string | null) ?? null,
    reportHash: (r.report_hash as string | null) ?? null,
    heinum: (r.heinum as number | null) ?? null,
    kind: r.kind === "annual" ? "annual" : "full",
    parentId: (r.parent_id as string | null) ?? null,
    completedAt: (r.completed_at as string | null) ?? null,
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
    naReason: (r.na_reason as string | null) ?? "",
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
    cause: (r.cause as string | null) ?? "",
    consequence: (r.consequence as string | null) ?? "",
    grade: r.grade as Grade,
    aiGrade: (r.ai_grade as Grade | null) ?? null,
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
  heinum?: number | null;
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
      `INSERT INTO inspections (id, created_at, status, tier, purpose, lang, address, postal_code, fastanumer, heinum,
        property_type, build_year, size_m2, construction, heating, has_basement, has_attic, contact_name, contact_email, price_isk,
        has_garage, has_fireplace, has_hot_tub, construction_stage)
       VALUES (@id, @createdAt, 'capturing', @tier, @purpose, @lang, @address, @postalCode, @fastanumer, @heinum,
        @propertyType, @buildYear, @sizeM2, @construction, @heating, @hasBasement, @hasAttic, @contactName, @contactEmail, @priceIsk,
        @hasGarage, @hasFireplace, @hasHotTub, @constructionStage)`,
    ).run({
      ...input,
      id,
      heinum: input.heinum ?? null,
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
  return { inspection, items, photos, findings, moisture: listMoisture(id) };
}

/** Full condition reports (yearly owner checks are listed under their report's history instead). */
export function listInspections(statuses?: InspectionStatus[]): Inspection[] {
  const db = getDb();
  const rows = statuses?.length
    ? (db
        .prepare(`SELECT * FROM inspections WHERE kind = 'full' AND status IN (${statuses.map(() => "?").join(",")}) ORDER BY created_at DESC`)
        .all(...statuses) as Row[])
    : (db.prepare("SELECT * FROM inspections WHERE kind = 'full' ORDER BY created_at DESC").all() as Row[]);
  return rows.map(toInspection);
}

/** Other full reports of the same property: same fastanúmer, or same address register id (possibly another unit). */
export function relatedReports(i: Inspection): { inspection: Inspection; match: "fastanumer" | "address" }[] {
  if (!i.fastanumer && !i.heinum) return [];
  const rows = getDb()
    .prepare(
      `SELECT * FROM inspections WHERE id <> @id AND kind = 'full'
        AND ((@fastanumer IS NOT NULL AND fastanumer = @fastanumer) OR (@heinum IS NOT NULL AND heinum = @heinum))
       ORDER BY created_at DESC LIMIT 20`,
    )
    .all({ id: i.id, fastanumer: i.fastanumer, heinum: i.heinum }) as Row[];
  return rows.map(toInspection).map((r) => ({
    inspection: r,
    match: i.fastanumer && r.fastanumer === i.fastanumer ? "fastanumer" : "address",
  }));
}

export function setStatus(id: string, status: InspectionStatus) {
  getDb().prepare("UPDATE inspections SET status = ? WHERE id = ?").run(status, id);
}

/** Only while the report can still change: a summary finishing after signing must not alter the sealed report. */
export function saveSummary(id: string, summary: InspectionSummaryAI) {
  getDb()
    .prepare("UPDATE inspections SET summary_json = ? WHERE id = ? AND status IN ('capturing', 'in_review')")
    .run(JSON.stringify(summary), id);
}

/** Everything fixed when an inspector signs: the signature, the independence declaration, the standard and the seal. */
export interface SignatureRecord {
  name: string;
  license: string;
  statement: string;
  signedAt: string;
  declaredAt: string;
  feeIsk: number | null;
  standardVersion: string;
  overallGrade: Grade;
  /** Null while locking; the seal is computed from the locked report right after. */
  reportHash: string | null;
}

/** Sign and lock in one statement; refuses unless the inspection is still in review. */
export function sealInspection(id: string, s: SignatureRecord): boolean {
  const res = getDb()
    .prepare(
      `UPDATE inspections SET inspector_name = @name, inspector_license = @license, inspector_statement = @statement,
        signed_at = @signedAt, declared_at = @declaredAt, fee_isk = @feeIsk, standard_version = @standardVersion,
        overall_grade = @overallGrade, report_hash = @reportHash, status = 'verified'
       WHERE id = @id AND status = 'in_review'`,
    )
    .run({ ...s, id });
  return res.changes === 1;
}

export function setReportHash(id: string, hash: string) {
  getDb().prepare("UPDATE inspections SET report_hash = ? WHERE id = ? AND status = 'verified'").run(hash, id);
}

/** Signed report by the start of its seal (at least 16 hex digits, already validated). */
export function findBySealPrefix(hexPrefix: string): Inspection | null {
  if (!/^[0-9a-f]{16,64}$/.test(hexPrefix)) return null;
  const rows = getDb().prepare("SELECT * FROM inspections WHERE report_hash LIKE ? LIMIT 2").all(`${hexPrefix}%`) as Row[];
  return rows.length === 1 ? toInspection(rows[0]) : null;
}

// ---------------------------------------------------------------- items

export function getItem(inspectionId: string, itemKey: string): InspectionItem | null {
  const r = getDb().prepare("SELECT * FROM items WHERE inspection_id = ? AND item_key = ?").get(inspectionId, itemKey) as
    | Row
    | undefined;
  return r ? toItem(r) : null;
}

export function updateItem(inspectionId: string, itemKey: string, patch: { notes?: string; notAccessible?: boolean; naReason?: string }) {
  const item = getItem(inspectionId, itemKey);
  if (!item) return null;
  const notes = patch.notes ?? item.notes;
  const notAccessible = patch.notAccessible ?? item.notAccessible;
  // The reason belongs to "not accessible": cleared when the item is opened again.
  const naReason = notAccessible ? (patch.naReason ?? item.naReason).trim() : "";
  const db = getDb();
  db.transaction(() => {
    if (notAccessible && !item.notAccessible) {
      // "Not accessible" means not assessed: drop any earlier AI result so it can't leak into the report.
      db.prepare("DELETE FROM findings WHERE inspection_id = ? AND item_key = ? AND source = 'ai'").run(inspectionId, itemKey);
      db.prepare("UPDATE items SET analysis_json = NULL WHERE id = ?").run(item.id);
    }
    const status: ItemStatus = notAccessible ? "skipped" : item.status === "skipped" ? "pending" : item.status;
    db.prepare("UPDATE items SET notes = ?, not_accessible = ?, na_reason = ?, status = ? WHERE id = ?").run(
      notes,
      notAccessible ? 1 : 0,
      naReason,
      status,
      item.id,
    );
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
  cause: string;
  consequence: string;
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
    // ai_grade keeps the AI's own grade even if the inspector edits it later (AI–inspector agreement).
    const ins = db.prepare(
      `INSERT INTO findings (id, inspection_id, item_key, source, title, description, cause, consequence, grade, ai_grade, confidence,
        photo_ids, recommended_action, follow_up, urgency, cost_key, review_status, inspector_note, created_at, updated_at)
       VALUES (?, ?, ?, 'ai', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, ?)`,
    );
    const ts = now();
    for (const f of findings) {
      ins.run(
        newId(12),
        inspectionId,
        itemKey,
        f.title,
        f.description,
        f.cause,
        f.consequence,
        f.grade,
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
  cause?: string;
  consequence?: string;
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
      `UPDATE findings SET title = ?, description = ?, cause = ?, consequence = ?, grade = ?, recommended_action = ?, follow_up = ?,
        urgency = ?, cost_key = ?, review_status = ?, inspector_note = ?, updated_at = ? WHERE id = ?`,
    )
    .run(
      next.title,
      next.description,
      next.cause,
      next.consequence,
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
      `INSERT INTO findings (id, inspection_id, item_key, source, title, description, cause, consequence, grade, confidence, photo_ids,
        recommended_action, follow_up, urgency, cost_key, review_status, inspector_note, created_at, updated_at)
       VALUES (?, ?, ?, 'inspector', ?, ?, ?, ?, ?, 'high', ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`,
    )
    .run(
      id,
      inspectionId,
      itemKey,
      f.title,
      f.description,
      f.cause,
      f.consequence,
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

// ---------------------------------------------------------------- moisture readings (inspector)

function toMoisture(r: Row): MoistureReading {
  return {
    id: r.id as string,
    inspectionId: r.inspection_id as string,
    itemKey: (r.item_key as string | null) ?? null,
    room: r.room as string,
    part: r.part as string,
    value: r.value as number,
    method: r.method === "pinless" ? "pinless" : "pin",
    createdAt: r.created_at as string,
  };
}

export function listMoisture(inspectionId: string): MoistureReading[] {
  return (getDb().prepare("SELECT * FROM moisture_readings WHERE inspection_id = ? ORDER BY created_at, id").all(inspectionId) as Row[]).map(
    toMoisture,
  );
}

export function getMoisture(id: string): MoistureReading | null {
  const r = getDb().prepare("SELECT * FROM moisture_readings WHERE id = ?").get(id) as Row | undefined;
  return r ? toMoisture(r) : null;
}

export function addMoisture(m: Omit<MoistureReading, "id" | "createdAt">): MoistureReading {
  const id = newId(12);
  getDb()
    .prepare(
      "INSERT INTO moisture_readings (id, inspection_id, item_key, room, part, value, method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, m.inspectionId, m.itemKey, m.room, m.part, m.value, m.method, now());
  return getMoisture(id)!;
}

export function deleteMoisture(id: string) {
  getDb().prepare("DELETE FROM moisture_readings WHERE id = ?").run(id);
}
