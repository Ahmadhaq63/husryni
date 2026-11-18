import { getDb } from "./db";
import { newId } from "./repo";
import type {
  DisputeReason,
  FixStatus,
  FixVerdict,
  Negotiation,
  Remedy,
  RemedyAction,
  SellerResponse,
} from "./types";

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();

function toNegotiation(r: Row): Negotiation {
  return {
    inspectionId: r.inspection_id as string,
    shareToken: r.share_token as string,
    ownerSharePct: (r.owner_share_pct as number | null) ?? null,
    responseDeadline: (r.response_deadline as string | null) ?? null,
    note: r.note as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function toRemedy(r: Row): Remedy {
  return {
    findingId: r.finding_id as string,
    inspectionId: r.inspection_id as string,
    action: r.action as RemedyAction,
    amountIsk: (r.amount_isk as number | null) ?? null,
    remark: r.remark as string,
    sellerResponse: r.seller_response as SellerResponse,
    disputeReason: (r.dispute_reason as DisputeReason | null) ?? null,
    sellerComment: r.seller_comment as string,
    fixStatus: r.fix_status as FixStatus,
    fixVerdict: r.fix_verdict_json ? (JSON.parse(r.fix_verdict_json as string) as FixVerdict) : null,
    updatedAt: r.updated_at as string,
  };
}

export function getNegotiation(inspectionId: string): Negotiation | null {
  const r = getDb().prepare("SELECT * FROM negotiations WHERE inspection_id = ?").get(inspectionId) as Row | undefined;
  return r ? toNegotiation(r) : null;
}

export function getNegotiationByToken(token: string): Negotiation | null {
  const r = getDb().prepare("SELECT * FROM negotiations WHERE share_token = ?").get(token) as Row | undefined;
  return r ? toNegotiation(r) : null;
}

/** Create on first use; the share token is a separate capability from the buyer's inspection link. */
export function ensureNegotiation(inspectionId: string): Negotiation {
  const existing = getNegotiation(inspectionId);
  if (existing) return existing;
  const ts = now();
  getDb()
    .prepare("INSERT INTO negotiations (inspection_id, share_token, note, created_at, updated_at) VALUES (?, ?, '', ?, ?)")
    .run(inspectionId, newId(18), ts, ts);
  return getNegotiation(inspectionId)!;
}

export function updateNegotiation(
  inspectionId: string,
  patch: { ownerSharePct?: number | null; responseDeadline?: string | null; note?: string },
): Negotiation {
  const n = ensureNegotiation(inspectionId);
  const next = { ...n, ...patch };
  getDb()
    .prepare("UPDATE negotiations SET owner_share_pct = ?, response_deadline = ?, note = ?, updated_at = ? WHERE inspection_id = ?")
    .run(next.ownerSharePct, next.responseDeadline, next.note, now(), inspectionId);
  return getNegotiation(inspectionId)!;
}

export function listRemedies(inspectionId: string): Map<string, Remedy> {
  const rows = getDb().prepare("SELECT * FROM remedies WHERE inspection_id = ?").all(inspectionId) as Row[];
  return new Map(rows.map((r) => [r.finding_id as string, toRemedy(r)]));
}

export function getRemedy(findingId: string): Remedy | null {
  const r = getDb().prepare("SELECT * FROM remedies WHERE finding_id = ?").get(findingId) as Row | undefined;
  return r ? toRemedy(r) : null;
}

/** Buyer side: choose the action for a finding. Changing the action resets the seller's answer and fix check. */
export function setRemedyAction(
  inspectionId: string,
  findingId: string,
  patch: { action: RemedyAction; amountIsk?: number | null; remark?: string },
): Remedy {
  const db = getDb();
  const current = getRemedy(findingId);
  const actionChanged = !current || current.action !== patch.action;
  const ts = now();
  if (!current) {
    db.prepare("INSERT INTO remedies (finding_id, inspection_id, action, amount_isk, remark, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      findingId,
      inspectionId,
      patch.action,
      patch.amountIsk ?? null,
      patch.remark ?? "",
      ts,
    );
  } else {
    db.prepare(
      `UPDATE remedies SET action = ?, amount_isk = ?, remark = ?, updated_at = ?,
        seller_response = CASE WHEN ? THEN 'none' ELSE seller_response END,
        dispute_reason = CASE WHEN ? THEN NULL ELSE dispute_reason END,
        fix_status = CASE WHEN ? THEN 'none' ELSE fix_status END,
        fix_verdict_json = CASE WHEN ? THEN NULL ELSE fix_verdict_json END
       WHERE finding_id = ?`,
    ).run(
      patch.action,
      patch.amountIsk === undefined ? current.amountIsk : patch.amountIsk,
      patch.remark ?? current.remark,
      ts,
      actionChanged ? 1 : 0,
      actionChanged ? 1 : 0,
      actionChanged ? 1 : 0,
      actionChanged ? 1 : 0,
      findingId,
    );
  }
  return getRemedy(findingId)!;
}

/** Seller side: accept or dispute a requested item. */
export function setSellerResponse(
  findingId: string,
  r: { sellerResponse: SellerResponse; disputeReason: DisputeReason | null; sellerComment: string },
): Remedy | null {
  if (!getRemedy(findingId)) return null;
  getDb()
    .prepare("UPDATE remedies SET seller_response = ?, dispute_reason = ?, seller_comment = ?, updated_at = ? WHERE finding_id = ?")
    .run(r.sellerResponse, r.sellerResponse === "disputed" ? r.disputeReason : null, r.sellerComment, now(), findingId);
  return getRemedy(findingId);
}

export function setFixStatus(findingId: string, status: FixStatus, verdict: FixVerdict | null) {
  getDb()
    .prepare("UPDATE remedies SET fix_status = ?, fix_verdict_json = ?, updated_at = ? WHERE finding_id = ?")
    .run(status, verdict ? JSON.stringify(verdict) : null, now(), findingId);
}

/** After-repair photos are stored as ordinary photos under a reserved item key. */
export const fixItemKey = (findingId: string) => `fix:${findingId}`;
