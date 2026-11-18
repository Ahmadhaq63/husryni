import crypto from "node:crypto";
import { getDb } from "./db";
import { draftQuoteLines, tradeFor, type Audience, type QuoteLine, type QuoteStatus, type Trade, type Triage } from "./ownerTools";
import { getBundle, newId } from "./repo";
import type { Lang } from "./types";

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();

// ---------------------------------------------------------------- read-only links

export interface ReadLink {
  token: string;
  inspectionId: string;
  audience: Audience;
  label: string;
  createdAt: string;
  revokedAt: string | null;
  views: number;
  lastViewedAt: string | null;
}

const toLink = (r: Row): ReadLink => ({
  token: r.token as string,
  inspectionId: r.inspection_id as string,
  audience: r.audience as Audience,
  label: r.label as string,
  createdAt: r.created_at as string,
  revokedAt: (r.revoked_at as string | null) ?? null,
  views: r.views as number,
  lastViewedAt: (r.last_viewed_at as string | null) ?? null,
});

export function listReadLinks(inspectionId: string): ReadLink[] {
  return (getDb().prepare("SELECT * FROM read_links WHERE inspection_id = ? ORDER BY created_at DESC").all(inspectionId) as Row[]).map(toLink);
}

export function getReadLink(token: string): ReadLink | null {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const r = getDb().prepare("SELECT * FROM read_links WHERE token = ?").get(token) as Row | undefined;
  return r ? toLink(r) : null;
}

export function createReadLink(inspectionId: string, audience: Audience, label: string): ReadLink {
  // 24 random bytes: unguessable, and a different secret from the owner's inspection link.
  const token = crypto.randomBytes(24).toString("base64url");
  getDb()
    .prepare("INSERT INTO read_links (token, inspection_id, audience, label, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(token, inspectionId, audience, label, now());
  return getReadLink(token)!;
}

export function revokeReadLink(inspectionId: string, token: string): boolean {
  const res = getDb()
    .prepare("UPDATE read_links SET revoked_at = ? WHERE token = ? AND inspection_id = ? AND revoked_at IS NULL")
    .run(now(), token, inspectionId);
  return res.changes === 1;
}

export function recordReadLinkView(token: string) {
  getDb().prepare("UPDATE read_links SET views = views + 1, last_viewed_at = ? WHERE token = ? AND revoked_at IS NULL").run(now(), token);
}

// ---------------------------------------------------------------- repair quotes

export interface Quote {
  id: string;
  inspectionId: string;
  number: string;
  trade: Trade;
  findingIds: string[];
  lines: QuoteLine[];
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

const toQuote = (r: Row): Quote => ({
  id: r.id as string,
  inspectionId: r.inspection_id as string,
  number: r.number as string,
  trade: r.trade as Trade,
  findingIds: JSON.parse(r.finding_ids as string) as string[],
  lines: JSON.parse(r.lines_json as string) as QuoteLine[],
  status: r.status as QuoteStatus,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
  approvedAt: (r.approved_at as string | null) ?? null,
});

export function listQuotes(inspectionId: string): Quote[] {
  return (getDb().prepare("SELECT * FROM quotes WHERE inspection_id = ? ORDER BY created_at, number").all(inspectionId) as Row[]).map(toQuote);
}

export function getQuote(inspectionId: string, quoteId: string): Quote | null {
  const r = getDb().prepare("SELECT * FROM quotes WHERE id = ? AND inspection_id = ?").get(quoteId, inspectionId) as Row | undefined;
  return r ? toQuote(r) : null;
}

/** Findings already in a quote that isn't discarded (a finding goes to one quote at a time). */
export function quotedFindingIds(inspectionId: string): Set<string> {
  return new Set(listQuotes(inspectionId).flatMap((q) => q.findingIds));
}

/** One draft per trade from the chosen findings. Findings already quoted or not TG1–TG3 are skipped. */
export function createQuoteDrafts(inspectionId: string, findingIds: string[], lang: Lang): Quote[] {
  const bundle = getBundle(inspectionId);
  if (!bundle) return [];
  const taken = quotedFindingIds(inspectionId);
  const chosen = bundle.findings.filter(
    (f) => findingIds.includes(f.id) && !taken.has(f.id) && f.reviewStatus !== "rejected" && ["TG1", "TG2", "TG3"].includes(f.grade),
  );
  const byTrade = new Map<Trade, typeof chosen>();
  for (const f of chosen) byTrade.set(tradeFor(f), [...(byTrade.get(tradeFor(f)) ?? []), ...[f]]);

  const db = getDb();
  const year = new Date().getFullYear();
  const created: string[] = [];
  db.transaction(() => {
    // Next number after the highest one used (a deleted draft never frees its number for reuse).
    let n = Math.max(0, ...listQuotes(inspectionId).map((q) => Number(q.number.split("-").pop()) || 0));
    const ins = db.prepare(
      "INSERT INTO quotes (id, inspection_id, number, trade, finding_ids, lines_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
    );
    for (const [trade, fs] of byTrade) {
      const id = newId(12);
      const ts = now();
      n += 1;
      ins.run(id, inspectionId, `TB-${year}-${String(n).padStart(3, "0")}`, trade, JSON.stringify(fs.map((f) => f.id)), JSON.stringify(draftQuoteLines(fs, trade, lang)), ts, ts);
      created.push(id);
    }
  })();
  return created.map((id) => getQuote(inspectionId, id)!);
}

/** Edit lines or move the status on. An approved quote is locked. */
export function updateQuote(inspectionId: string, quoteId: string, patch: { lines?: QuoteLine[]; status?: QuoteStatus }): Quote | null {
  const q = getQuote(inspectionId, quoteId);
  if (!q || q.status === "approved") return null;
  const lines = patch.lines ?? q.lines;
  const status = patch.status ?? q.status;
  getDb()
    .prepare("UPDATE quotes SET lines_json = ?, status = ?, updated_at = ?, approved_at = ? WHERE id = ? AND inspection_id = ?")
    .run(JSON.stringify(lines), status, now(), status === "approved" ? now() : null, quoteId, inspectionId);
  return getQuote(inspectionId, quoteId);
}

export function deleteQuote(inspectionId: string, quoteId: string): boolean {
  return getDb().prepare("DELETE FROM quotes WHERE id = ? AND inspection_id = ? AND status <> 'approved'").run(quoteId, inspectionId).changes === 1;
}

// ---------------------------------------------------------------- problem reports

export interface ProblemReport {
  id: string;
  inspectionId: string;
  text: string;
  triage: Triage | null;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
}

const toProblem = (r: Row): ProblemReport => ({
  id: r.id as string,
  inspectionId: r.inspection_id as string,
  text: r.text as string,
  triage: r.triage_json ? (JSON.parse(r.triage_json as string) as Triage) : null,
  status: r.status === "resolved" ? "resolved" : "open",
  createdAt: r.created_at as string,
  resolvedAt: (r.resolved_at as string | null) ?? null,
});

export function listProblems(inspectionId: string): ProblemReport[] {
  return (getDb().prepare("SELECT * FROM problem_reports WHERE inspection_id = ? ORDER BY created_at DESC").all(inspectionId) as Row[]).map(toProblem);
}

/** Record a problem; the triage is added when it is ready (setProblemTriage), or the row removed if it fails. */
export function addProblem(inspectionId: string, text: string, triage: Triage | null = null): ProblemReport {
  const id = newId(12);
  getDb()
    .prepare("INSERT INTO problem_reports (id, inspection_id, text, triage_json, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, inspectionId, text, triage ? JSON.stringify(triage) : null, now());
  return listProblems(inspectionId).find((p) => p.id === id)!;
}

export function setProblemTriage(problemId: string, triage: Triage): ProblemReport | null {
  getDb().prepare("UPDATE problem_reports SET triage_json = ? WHERE id = ?").run(JSON.stringify(triage), problemId);
  const r = getDb().prepare("SELECT * FROM problem_reports WHERE id = ?").get(problemId) as Row | undefined;
  return r ? toProblem(r) : null;
}

export function deleteProblem(problemId: string) {
  getDb().prepare("DELETE FROM problem_reports WHERE id = ?").run(problemId);
}

export function setProblemStatus(inspectionId: string, problemId: string, status: "open" | "resolved"): boolean {
  return (
    getDb()
      .prepare("UPDATE problem_reports SET status = ?, resolved_at = ? WHERE id = ? AND inspection_id = ?")
      .run(status, status === "resolved" ? now() : null, problemId, inspectionId).changes === 1
  );
}

// ---------------------------------------------------------------- assistant log (also caps use per day)

/** Log a question (answer "" while it is being answered); returns the row id. */
export function logAssistant(inspectionId: string, question: string, answer: string, engine: string, usage?: { inputTokens: number; outputTokens: number }): number {
  return Number(
    getDb()
      .prepare(
        "INSERT INTO assistant_log (inspection_id, question, answer, engine, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(inspectionId, question, answer, engine, usage?.inputTokens ?? null, usage?.outputTokens ?? null, now()).lastInsertRowid,
  );
}

export function completeAssistant(rowId: number, answer: string, engine: string, usage?: { inputTokens: number; outputTokens: number }) {
  getDb()
    .prepare("UPDATE assistant_log SET answer = ?, engine = ?, input_tokens = ?, output_tokens = ? WHERE id = ?")
    .run(answer, engine, usage?.inputTokens ?? null, usage?.outputTokens ?? null, rowId);
}

/** A question that got no answer (service error) doesn't count against the day's cap. */
export function dropAssistant(rowId: number) {
  getDb().prepare("DELETE FROM assistant_log WHERE id = ?").run(rowId);
}

export function assistantQuestionsToday(inspectionId: string): number {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return (getDb().prepare("SELECT COUNT(*) AS n FROM assistant_log WHERE inspection_id = ? AND created_at >= ?").get(inspectionId, since) as { n: number }).n;
}
