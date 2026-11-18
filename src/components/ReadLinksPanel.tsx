"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getDict } from "@/lib/i18n";
import { AUDIENCE_LABEL, AUDIENCES, type Audience } from "@/lib/ownerTools";
import type { Lang } from "@/lib/types";

export interface ReadLinkView {
  token: string;
  audience: Audience;
  label: string;
  createdText: string;
  views: number;
  lastViewedText: string | null;
  revoked: boolean;
}

/** The owner shares the report read-only (insurer, bank …) and can revoke each link. */
export default function ReadLinksPanel({ inspectionId, lang, links, origin }: { inspectionId: string; lang: Lang; links: ReadLinkView[]; origin: string }) {
  const t = getDict(lang);
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [audience, setAudience] = useState<Audience>("insurer");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const url = (token: string) => `${origin}/r/${token}`;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/read-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, label }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.[lang] ?? t.error);
        return;
      }
      setLabel("");
      startRefresh(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function revoke(token: string) {
    setBusy(true);
    try {
      await fetch(`/api/inspections/${inspectionId}/read-links/${token}`, { method: "DELETE" });
      startRefresh(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(url(token));
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="rl">
      <h3 className="rl__title">
        <i className="bi bi-share" aria-hidden />
        {t.rlTitle}
      </h3>
      <p className="rl__lead">{t.rlLead}</p>
      <div className="rl__form">
        <div>
          <label className="form-label" htmlFor="rl-aud">
            {t.rlAudience}
          </label>
          <select id="rl-aud" className="form-select form-select-sm" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {AUDIENCE_LABEL[a][lang]}
              </option>
            ))}
          </select>
        </div>
        <div className="rl__labelcol">
          <label className="form-label" htmlFor="rl-label">
            {t.rlLabel}
          </label>
          <input id="rl-label" className="form-control form-control-sm" maxLength={80} placeholder={t.rlLabelPh} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={create}>
          <i className="bi bi-link-45deg me-1" aria-hidden />
          {t.rlCreate}
        </button>
      </div>
      <p className="rl__consent">
        <i className="bi bi-shield-check" aria-hidden /> {t.rlConsent}
      </p>
      {error && (
        <div className="rp-callout rp-callout--danger" role="alert">
          <i className="bi bi-exclamation-circle" aria-hidden />
          <div>{error}</div>
        </div>
      )}
      {links.length === 0 ? (
        <p className="rl__none">{t.rlNone}</p>
      ) : (
        <ul className="rl__list">
          {links.map((l) => (
            <li key={l.token} className={l.revoked ? "is-revoked" : undefined}>
              <div className="rl__who">
                <strong>{AUDIENCE_LABEL[l.audience][lang]}</strong>
                {l.label && <span> · {l.label}</span>}
                <div className="rl__meta">
                  {l.createdText} · {l.views ? t.rlViews.replace("{n}", String(l.views)) : t.rlNever}
                  {l.lastViewedText && ` (${l.lastViewedText})`}
                </div>
                {!l.revoked && <code className="rl__url">{url(l.token)}</code>}
              </div>
              {l.revoked ? (
                <span className="rp-chip rp-chip--neutral">{t.rlRevoked}</span>
              ) : (
                <div className="rl__actions">
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => copy(l.token)}>
                    <i className={`bi ${copied === l.token ? "bi-check2" : "bi-clipboard"} me-1`} aria-hidden />
                    {copied === l.token ? t.rlCopied : t.rlCopy}
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => revoke(l.token)}>
                    {t.rlRevoke}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
