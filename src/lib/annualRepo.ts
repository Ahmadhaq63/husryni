import { ANNUAL_QUESTIONS, annualMissing, isProblem, isResolved, questionPhotoKey, nextDue } from "./annual";
import { getDb } from "./db";
import { GRADE_INFO } from "./labels";
import { getBundle, getFinding, getInspection, listItemPhotos, newId } from "./repo";
import type { AnnualAnswer, Finding, FollowUpAnswer, FollowUpRecord, FollowUpVerdict, Inspection, QuestionAnswer } from "./types";

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();

/** The full report a yearly check belongs to (a full report is its own root). */
export const rootIdOf = (i: Inspection) => (i.kind === "annual" && i.parentId ? i.parentId : i.id);

/** A report's history can start once the report is final. */
export const historyOpen = (i: Inspection) => i.kind === "full" && (i.status === "ai_report" || i.status === "verified");

export function listAnnualChecks(rootId: string): Inspection[] {
  const ids = getDb().prepare("SELECT id FROM inspections WHERE parent_id = ? AND kind = 'annual' ORDER BY created_at").all(rootId) as {
    id: string;
  }[];
  return ids.map((r) => getInspection(r.id)!).filter(Boolean);
}

function toFollowUp(r: Row): FollowUpRecord {
  return {
    inspectionId: r.inspection_id as string,
    findingId: r.finding_id as string,
    position: r.position as number,
    answer: (r.answer as FollowUpAnswer | null) ?? null,
    note: r.note as string,
    verdict: r.verdict_json ? (JSON.parse(r.verdict_json as string) as FollowUpVerdict) : null,
    updatedAt: r.updated_at as string,
  };
}

function toAnswer(r: Row): AnnualAnswer {
  return {
    inspectionId: r.inspection_id as string,
    questionId: r.question_id as string,
    answer: (r.answer as QuestionAnswer | null) ?? null,
    note: r.note as string,
    updatedAt: r.updated_at as string,
  };
}

export function getFollowUps(annualId: string): FollowUpRecord[] {
  return (getDb().prepare("SELECT * FROM followups WHERE inspection_id = ? ORDER BY position").all(annualId) as Row[]).map(toFollowUp);
}

export function getFollowUp(annualId: string, findingId: string): FollowUpRecord | null {
  const r = getDb().prepare("SELECT * FROM followups WHERE inspection_id = ? AND finding_id = ?").get(annualId, findingId) as Row | undefined;
  return r ? toFollowUp(r) : null;
}

export function getAnswers(annualId: string): AnnualAnswer[] {
  return (getDb().prepare("SELECT * FROM annual_answers WHERE inspection_id = ?").all(annualId) as Row[]).map(toAnswer);
}

/**
 * Findings still open on the property: the report's TG1–TG3 findings and problems raised in earlier yearly
 * checks, minus those a later completed check closed (owner says fixed and the photo check, if run, agrees).
 * Most severe first.
 */
export function openFindings(rootId: string): Finding[] {
  const root = getBundle(rootId);
  if (!root) return [];
  const checks = listAnnualChecks(rootId).filter((c) => c.status === "ai_report");
  const candidates: Finding[] = root.findings.filter(
    (f) => f.reviewStatus !== "rejected" && (f.grade === "TG1" || f.grade === "TG2" || f.grade === "TG3"),
  );
  for (const c of checks) candidates.push(...(getBundle(c.id)?.findings ?? []).filter((f) => f.source === "owner"));
  // The latest completed answer per finding decides.
  const latest = new Map<string, FollowUpRecord>();
  for (const c of checks) for (const fu of getFollowUps(c.id)) latest.set(fu.findingId, fu);
  return candidates
    .filter((f) => {
      const fu = latest.get(f.id);
      return !fu || !isResolved(fu);
    })
    .sort((a, b) => GRADE_INFO[b.grade].severity - GRADE_INFO[a.grade].severity);
}

/** When the property's condition was last confirmed: the latest completed yearly check, or the report. */
export function lastConfirmed(root: Inspection): string {
  const done = listAnnualChecks(root.id)
    .filter((c) => c.status === "ai_report" && c.completedAt)
    .map((c) => c.completedAt!);
  return done.length ? done[done.length - 1] : (root.signedAt ?? root.createdAt);
}

export const dueDate = (root: Inspection) => nextDue(lastConfirmed(root));

/** Start a yearly check for a final report, or return the one already in progress. */
export function startAnnualCheck(rootId: string): string | null {
  const root = getInspection(rootId);
  if (!root || !historyOpen(root)) return null;
  const db = getDb();
  const open = db.prepare("SELECT id FROM inspections WHERE parent_id = ? AND kind = 'annual' AND status = 'capturing'").get(rootId) as
    | { id: string }
    | undefined;
  if (open) return open.id;

  const id = newId();
  const ts = now();
  const findings = openFindings(rootId);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO inspections (id, created_at, status, tier, purpose, lang, address, postal_code, fastanumer, heinum, property_type, build_year,
         size_m2, construction, heating, has_basement, has_attic, has_garage, has_fireplace, has_hot_tub, construction_stage,
         contact_name, contact_email, price_isk, kind, parent_id)
       SELECT ?, ?, 'capturing', 'basic', 'owner', lang, address, postal_code, fastanumer, heinum, property_type, build_year,
         size_m2, construction, heating, has_basement, has_attic, has_garage, has_fireplace, has_hot_tub, construction_stage,
         contact_name, contact_email, NULL, 'annual', id
       FROM inspections WHERE id = ?`,
    ).run(id, ts, rootId);
    const ins = db.prepare("INSERT INTO followups (inspection_id, finding_id, position, updated_at) VALUES (?, ?, ?, ?)");
    findings.forEach((f, i) => ins.run(id, f.id, i, ts));
  })();
  return id;
}

/** Only while the yearly check is being filled in. */
function editable(annualId: string): Inspection | null {
  const i = getInspection(annualId);
  return i && i.kind === "annual" && i.status === "capturing" ? i : null;
}

export function setFollowUp(annualId: string, findingId: string, patch: { answer?: FollowUpAnswer | null; note?: string }): FollowUpRecord | null {
  if (!editable(annualId)) return null;
  const fu = getFollowUp(annualId, findingId);
  if (!fu) return null;
  const answer = patch.answer === undefined ? fu.answer : patch.answer;
  const note = patch.note ?? fu.note;
  getDb()
    .prepare("UPDATE followups SET answer = ?, note = ?, updated_at = ? WHERE inspection_id = ? AND finding_id = ?")
    .run(answer, note, now(), annualId, findingId);
  return getFollowUp(annualId, findingId);
}

/** Store (or clear) the photo comparison. Only while the check is open: a late verdict must not change a submitted one. */
export function setFollowUpVerdict(annualId: string, findingId: string, verdict: FollowUpVerdict | null): boolean {
  return (
    getDb()
      .prepare(
        `UPDATE followups SET verdict_json = ?, updated_at = ? WHERE inspection_id = ? AND finding_id = ?
           AND EXISTS (SELECT 1 FROM inspections WHERE id = followups.inspection_id AND kind = 'annual' AND status = 'capturing')`,
      )
      .run(verdict ? JSON.stringify(verdict) : null, now(), annualId, findingId).changes === 1
  );
}

/** The photos of a follow-up changed: its comparison no longer describes them. */
export function photosChanged(annualId: string, photoKey: string) {
  if (photoKey.startsWith("fu:")) setFollowUpVerdict(annualId, photoKey.slice(3), null);
}

export function setAnswer(annualId: string, questionId: string, patch: { answer?: QuestionAnswer | null; note?: string }): AnnualAnswer | null {
  if (!editable(annualId) || !ANNUAL_QUESTIONS.some((q) => q.id === questionId)) return null;
  const current = getAnswers(annualId).find((a) => a.questionId === questionId);
  const answer = patch.answer === undefined ? (current?.answer ?? null) : patch.answer;
  const note = patch.note ?? current?.note ?? "";
  getDb()
    .prepare(
      `INSERT INTO annual_answers (inspection_id, question_id, answer, note, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (inspection_id, question_id) DO UPDATE SET answer = excluded.answer, note = excluded.note, updated_at = excluded.updated_at`,
    )
    .run(annualId, questionId, answer, note, now());
  return getAnswers(annualId).find((a) => a.questionId === questionId) ?? null;
}

export type SubmitResult = { ok: true } | { ok: false; missing: { followUps: string[]; questions: string[] } };

/** Complete the check: every follow-up and question answered; each problem becomes a finding on the history. */
export function submitAnnualCheck(annualId: string): SubmitResult | null {
  const check = editable(annualId);
  if (!check) return null;
  const followups = getFollowUps(annualId);
  const answers = getAnswers(annualId);
  const missing = annualMissing(followups, answers);
  if (missing.followUps.length || missing.questions.length) return { ok: false, missing };

  const db = getDb();
  const ts = now();
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  db.transaction(() => {
    const ins = db.prepare(
      `INSERT INTO findings (id, inspection_id, item_key, source, title, description, cause, consequence, grade, confidence, photo_ids,
         recommended_action, follow_up, urgency, cost_key, review_status, inspector_note, created_at, updated_at)
       VALUES (?, ?, ?, 'owner', ?, ?, '', '', ?, 'medium', ?, '', ?, ?, 'none', 'confirmed', '', ?, ?)`,
    );
    for (const q of ANNUAL_QUESTIONS) {
      const a = byQ.get(q.id);
      if (!a || !isProblem(q, a.answer)) continue;
      const photos = listItemPhotos(annualId, questionPhotoKey(q.id)).map((p) => p.id);
      const description = a.note.trim() || q.text[check.lang];
      ins.run(newId(12), annualId, q.itemKey, q.findingTitle[check.lang], description, q.grade, JSON.stringify(photos), q.followUp, q.urgency, ts, ts);
    }
    db.prepare("UPDATE inspections SET status = 'ai_report', completed_at = ? WHERE id = ? AND status = 'capturing'").run(ts, annualId);
  })();
  return { ok: true };
}

/** The finding a follow-up is about, with the inspection it came from (for its BEFORE photos). */
export function followUpTarget(annualId: string, findingId: string) {
  const annual = getInspection(annualId);
  const fu = getFollowUp(annualId, findingId);
  const finding = getFinding(findingId);
  if (!annual || annual.kind !== "annual" || !fu || !finding) return null;
  return { annual, fu, finding };
}
