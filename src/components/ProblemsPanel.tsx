"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export interface ProblemView {
  id: string;
  text: string;
  createdText: string;
  status: "open" | "resolved";
  category: string;
  trade: string;
  urgency: string;
  within: string;
  advice: string;
  urgent: boolean;
}

/** Report a problem between checks: triage (trade, how soon, what to do now) and a log on the property history. */
export default function ProblemsPanel({ inspectionId, lang, problems }: { inspectionId: string; lang: Lang; problems: ProblemView[] }) {
  const t = getDict(lang);
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => startRefresh(() => router.refresh());

  async function report() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.[lang] ?? t.error);
        return;
      }
      setText("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "open" | "resolved") {
    await fetch(`/api/inspections/${inspectionId}/problems/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    refresh();
  }

  return (
    <section className="card rp-card mt-4" aria-labelledby="pr-title">
      <div className="card-body">
        <h2 id="pr-title" className="rp-label">
          {t.prTitle}
        </h2>
        <p className="pr__lead">{t.prLead}</p>
        <div className="pr__chips">
          {[t.prEx1, t.prEx2, t.prEx3, t.prEx4].map((x) => (
            <button key={x} type="button" className="ask-chip" disabled={busy} onClick={() => setText(x)}>
              {x}
            </button>
          ))}
        </div>
        <label className="visually-hidden" htmlFor="pr-text">
          {t.prTitle}
        </label>
        <textarea id="pr-text" className="form-control" rows={2} maxLength={1000} placeholder={t.prPh} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="d-flex justify-content-end mt-2">
          <button type="button" className="btn btn-primary" disabled={busy || text.trim().length < 3} onClick={report}>
            {busy ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" aria-hidden />
                {t.prSending}
              </>
            ) : (
              <>
                <i className="bi bi-megaphone me-2" aria-hidden />
                {t.prSend}
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="rp-callout rp-callout--danger mt-2" role="alert">
            <i className="bi bi-exclamation-circle" aria-hidden />
            <div>{error}</div>
          </div>
        )}
        {problems.length > 0 && (
          <>
            <h3 className="pr__listhead">{t.prList}</h3>
            <ul className="pr__list">
              {problems.map((p) => (
                <li key={p.id} className={`pr-item${p.status === "resolved" ? " is-resolved" : ""}${p.urgent ? " is-urgent" : ""}`}>
                  <div className="pr-item__top">
                    <strong>{p.category}</strong>
                    <span className="pr-item__date">{p.createdText}</span>
                    <span className={`rp-chip ${p.status === "resolved" ? "rp-chip--success" : "rp-chip--warning"}`}>
                      {p.status === "resolved" ? t.prResolved : t.prOpen}
                    </span>
                  </div>
                  <p className="pr-item__text">“{p.text}”</p>
                  <dl className="pr-item__route">
                    <div>
                      <dt>{t.prCall}</dt>
                      <dd>{p.trade}</dd>
                    </div>
                    <div>
                      <dt>{t.prWithin}</dt>
                      <dd>{p.within}</dd>
                    </div>
                    {p.advice && (
                      <div className="is-wide">
                        <dt>{t.prNow}</dt>
                        <dd>{p.advice}</dd>
                      </div>
                    )}
                  </dl>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setStatus(p.id, p.status === "resolved" ? "open" : "resolved")}>
                    {p.status === "resolved" ? t.prReopen : t.prResolve}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
