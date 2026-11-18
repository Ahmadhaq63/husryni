"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import GradeBadge from "./GradeBadge";
import { getDict, type Dict } from "@/lib/i18n";
import { iskText, quoteTotals, type QuoteLine, type QuoteStatus } from "@/lib/ownerTools";
import type { Grade, Lang } from "@/lib/types";

export interface QuotableView {
  id: string;
  title: string;
  itemTitle: string;
  grade: Grade;
  trade: string;
}

export interface QuoteView {
  id: string;
  number: string;
  trade: string;
  status: QuoteStatus;
  lines: QuoteLine[];
  basedOn: string[];
  approvedText: string | null;
}

async function errorText(res: Response, lang: Lang, fallback: string) {
  try {
    const body = await res.json();
    return (body?.error?.[lang] as string | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Repair quote drafts: choose findings, get one draft per trade, review the lines, send, approve. */
export default function QuotesClient({ inspectionId, lang, available, quotes }: { inspectionId: string; lang: Lang; available: QuotableView[]; quotes: QuoteView[] }) {
  const t = getDict(lang);
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());
  const [chosen, setChosen] = useState<Set<string>>(new Set(available.map((a) => a.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findingIds: [...chosen] }),
      });
      if (!res.ok) setError(await errorText(res, lang, t.error));
      else setChosen(new Set());
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="qt">
      <section className="card rp-card" aria-labelledby="qt-choose">
        <div className="card-body">
          <h2 id="qt-choose" className="rp-label">
            {t.qtChoose}
          </h2>
          {available.length === 0 ? (
            <p className="mb-0">{t.qtNoItems}</p>
          ) : (
            <>
              <ul className="qt__choose">
                {available.map((a) => (
                  <li key={a.id}>
                    <label className="qt__pick">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={chosen.has(a.id)}
                        onChange={(e) => {
                          const next = new Set(chosen);
                          if (e.target.checked) next.add(a.id);
                          else next.delete(a.id);
                          setChosen(next);
                        }}
                      />
                      <GradeBadge grade={a.grade} lang={lang} compact />
                      <span className="qt__pickbody">
                        <strong>{a.title}</strong>
                        <span className="qt__pickmeta">
                          {a.itemTitle} · {a.trade}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button type="button" className="btn btn-primary" disabled={busy || chosen.size === 0} onClick={create}>
                <i className="bi bi-stars me-2" aria-hidden />
                {t.qtCreate}
              </button>
            </>
          )}
          {error && (
            <div className="rp-callout rp-callout--danger mt-3" role="alert">
              <i className="bi bi-exclamation-circle" aria-hidden />
              <div>{error}</div>
            </div>
          )}
        </div>
      </section>

      {quotes.length === 0 ? (
        <p className="qt__none">{t.qtNone}</p>
      ) : (
        quotes.map((q) => <QuoteCard key={q.id} inspectionId={inspectionId} q={q} lang={lang} t={t} onChanged={refresh} />)
      )}
      <p className="qt__note">
        <i className="bi bi-info-circle" aria-hidden /> {t.qtPlaceholder}
      </p>
    </div>
  );
}

/** A line as typed: numbers stay text while editing, so "2," on the way to "2,5" isn't swallowed. */
interface EditLine {
  description: string;
  qty: string;
  unit: string;
  unitPrice: string;
}
const numText = (n: number, lang: Lang) => String(n).replace(".", lang === "is" ? "," : ".");
const toEdit = (lines: QuoteLine[], lang: Lang): EditLine[] =>
  lines.map((l) => ({ description: l.description, qty: numText(l.qty, lang), unit: l.unit, unitPrice: numText(l.unitPrice, lang) }));
const parseNum = (s: string) => {
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const toLines = (lines: EditLine[]): QuoteLine[] =>
  lines.map((l) => ({ description: l.description.trim(), qty: parseNum(l.qty), unit: l.unit.trim(), unitPrice: Math.round(parseNum(l.unitPrice)) }));

function QuoteCard({ inspectionId, q, lang, t, onChanged }: { inspectionId: string; q: QuoteView; lang: Lang; t: Dict; onChanged: () => void }) {
  const id = useId();
  const [edit, setEdit] = useState<EditLine[]>(() => toEdit(q.lines, lang));
  const lines = toLines(edit);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = q.status === "approved";
  const dirty = JSON.stringify(lines) !== JSON.stringify(q.lines);
  const totals = quoteTotals(lines);
  const steps: QuoteStatus[] = ["draft", "sent", "approved"];
  const label: Record<QuoteStatus, string> = { draft: t.qtDraft, sent: t.qtSent, approved: t.qtApproved };

  async function patch(body: { lines?: QuoteLine[]; status?: QuoteStatus }) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/quotes/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await errorText(res, lang, t.error));
        return;
      }
      // Show what the server stored (it trims and validates), so "unsaved changes" reflects reality.
      const stored = (await res.json().catch(() => null)) as { lines?: QuoteLine[] } | null;
      if (stored?.lines) setEdit(toEdit(stored.lines, lang));
      if (body.lines) setSaved(true);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/inspections/${inspectionId}/quotes/${q.id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const set = (i: number, patchLine: Partial<EditLine>) => setEdit(edit.map((l, k) => (k === i ? { ...l, ...patchLine } : l)));

  return (
    <section className={`card rp-card qt-card${locked ? " is-locked" : ""}`} aria-labelledby={`${id}-h`}>
      <div className="card-body">
        <header className="qt-card__head">
          <div>
            <h2 id={`${id}-h`} className="qt-card__title">
              <span className="rp-mono">{q.number}</span> · {q.trade}
            </h2>
            <div className="qt-card__basis">
              {t.qtBasedOn}: {q.basedOn.join(" · ")}
            </div>
          </div>
          <ol className="qt-steps" aria-label={label[q.status]}>
            {steps.map((s, i) => (
              <li key={s} className={i < steps.indexOf(q.status) ? "is-done" : s === q.status ? "is-on" : undefined}>
                {label[s]}
              </li>
            ))}
          </ol>
        </header>
        {locked && q.approvedText && (
          <div className="rp-callout rp-callout--info mb-3">
            <i className="bi bi-lock" aria-hidden />
            <div>{t.qtApprovedNote.replace("{date}", q.approvedText)}</div>
          </div>
        )}
        <div className="table-responsive">
          <table className="rp-table qt-lines">
            <thead>
              <tr>
                <th scope="col">{t.qtDesc}</th>
                <th scope="col" className="num">
                  {t.qtQty}
                </th>
                <th scope="col">{t.qtUnit}</th>
                <th scope="col" className="num">
                  {t.qtPrice}
                </th>
                <th scope="col" className="num">
                  {t.qtLineTotal}
                </th>
                {!locked && (
                  <th scope="col">
                    <span className="visually-hidden">{t.qtDeleteLine}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {edit.map((l, i) => (
                <tr key={i}>
                  <td>
                    {locked ? (
                      l.description
                    ) : (
                      <input className="form-control form-control-sm" aria-label={t.qtDesc} value={l.description} onChange={(e) => set(i, { description: e.target.value })} />
                    )}
                  </td>
                  <td className="num">
                    {locked ? (
                      l.qty
                    ) : (
                      <input className="form-control form-control-sm qt-num" inputMode="decimal" aria-label={t.qtQty} value={l.qty} onChange={(e) => set(i, { qty: e.target.value })} />
                    )}
                  </td>
                  <td>
                    {locked ? (
                      l.unit
                    ) : (
                      <input className="form-control form-control-sm qt-unit" aria-label={t.qtUnit} value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} />
                    )}
                  </td>
                  <td className="num">
                    {locked ? (
                      iskText(lines[i].unitPrice, lang)
                    ) : (
                      <input className="form-control form-control-sm qt-price" inputMode="numeric" aria-label={t.qtPrice} value={l.unitPrice} onChange={(e) => set(i, { unitPrice: e.target.value })} />
                    )}
                  </td>
                  <td className="num">{iskText(lines[i].qty * lines[i].unitPrice, lang)}</td>
                  {!locked && (
                    <td>
                      <button type="button" className="btn btn-sm btn-link text-danger p-0" aria-label={`${t.qtDeleteLine} ${i + 1}`} onClick={() => setEdit(edit.filter((_, k) => k !== i))}>
                        <i className="bi bi-x-lg" aria-hidden />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={4}>
                  {t.qtNet}
                </th>
                <td className="num">{iskText(totals.net, lang)}</td>
                {!locked && <td />}
              </tr>
              <tr>
                <th scope="row" colSpan={4}>
                  {t.qtVat}
                </th>
                <td className="num">{iskText(totals.vat, lang)}</td>
                {!locked && <td />}
              </tr>
              <tr className="rp-total">
                <th scope="row" colSpan={4}>
                  {t.qtTotal}
                </th>
                <td className="num">{iskText(totals.total, lang)}</td>
                {!locked && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
        {!locked && (
          <div className="qt-card__bar">
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEdit([...edit, { description: "", qty: "1", unit: lang === "is" ? "stk." : "pcs", unitPrice: "0" }])}>
                <i className="bi bi-plus-lg me-1" aria-hidden />
                {t.qtAddLine}
              </button>
              <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy || !dirty || lines.some((l) => !l.description.trim())} onClick={() => patch({ lines })}>
                {saved && !dirty ? `✓ ${t.qtSaved}` : t.qtSave}
              </button>
              {q.status === "draft" && (
                <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={remove}>
                  {t.qtDelete}
                </button>
              )}
            </div>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              {q.status === "draft" && (
                <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy || dirty} onClick={() => patch({ status: "sent" })}>
                  {t.qtMarkSent}
                </button>
              )}
              <label className="form-check-label small">
                <input type="checkbox" className="form-check-input me-1" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
                {t.qtReviewed}
              </label>
              <button type="button" className="btn btn-sm btn-primary" disabled={busy || dirty || !reviewed} onClick={() => patch({ status: "approved" })}>
                <i className="bi bi-check2-circle me-1" aria-hidden />
                {t.qtApprove}
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="rp-callout rp-callout--danger mt-3" role="alert">
            <i className="bi bi-exclamation-circle" aria-hidden />
            <div>{error}</div>
          </div>
        )}
      </div>
    </section>
  );
}
