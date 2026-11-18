"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type CSSProperties } from "react";
import GradeBadge from "./GradeBadge";
import { formatIskStable as formatIsk } from "./report/format";
import { Chip, type ChipTone } from "./report/ui";
import { GRADE_COLOR } from "@/lib/gradeColors";
import { getDict, type Dict } from "@/lib/i18n";
import { LEGAL_REFERENCE, type NegotiationTotals } from "@/lib/negotiation";
import { ACTION_LABEL } from "@/lib/negotiationLabels";
import type { Grade, Lang, Remedy, RemedyAction } from "@/lib/types";

export interface NegItem {
  id: string;
  itemTitle: string;
  title: string;
  description: string;
  grade: Grade;
  estimate: number;
  costRange: string | null;
  likelyCommon: boolean;
  photoIds: string[];
  afterPhotoIds: string[];
  remedy: Remedy | null;
}

interface Props {
  inspectionId: string;
  lang: Lang;
  items: NegItem[];
  hasAssociation: boolean;
  shareToken: string;
  settings: { ownerSharePct: number | null; responseDeadline: string | null; note: string };
  totals: NegotiationTotals;
  priceIsk: number | null;
}

const pct = (part: number, whole: number | null) => (whole ? `${((part / whole) * 100).toFixed(1)} %` : null);

async function errorText(res: Response, lang: Lang, fallback: string) {
  try {
    const body = await res.json();
    return (body?.error?.[lang] as string | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

const ACTION_ICON: Record<RemedyAction, string> = {
  seller_fix: "bi-tools",
  price_reduction: "bi-percent",
  hoa: "bi-buildings",
  accept: "bi-check2",
  none: "bi-dash-circle",
};

export default function NegotiationClient(props: Props) {
  const { inspectionId, lang, items, hasAssociation, shareToken, settings, totals, priceIsk } = props;
  const t = getDict(lang);
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const [form, setForm] = useState({
    ownerSharePct: settings.ownerSharePct?.toString() ?? "",
    responseDeadline: settings.responseDeadline ?? "",
    note: settings.note,
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState(`/s/${shareToken}`);
  const [copied, setCopied] = useState(false);
  useEffect(() => setShareUrl(`${window.location.origin}/s/${shareToken}`), [shareToken]);

  async function saveSettings() {
    setSaveState("saving");
    setError(null);
    const share = form.ownerSharePct.replace(",", ".").trim();
    const res = await fetch(`/api/inspections/${inspectionId}/negotiation`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerSharePct: share ? Number(share) : null,
        responseDeadline: form.responseDeadline || null,
        note: form.note,
      }),
    });
    if (!res.ok) {
      setError(await errorText(res, lang, t.error));
      setSaveState("idle");
      return;
    }
    setSaveState("saved");
    refresh();
  }

  const L = ACTION_LABEL(t);
  const rows: [string, number, boolean?][] = [
    [t.totPriceReduction, totals.priceReduction],
    [t.totSellerFix, totals.sellerFixValue],
    [t.totRequested, totals.requestedFromSeller, true],
    ...(hasAssociation ? ([[t.totHoaShare, totals.hoaBuyerShare]] as [string, number][]) : []),
    [t.totBuyerBears, totals.buyerBears],
    [t.totAllRepairs, totals.allRepairs, true],
  ];

  return (
    <div className="rp-split">
      <div className="rp-split__main">
        {items.map((item) => (
          <NegotiationItem key={item.id} item={item} inspectionId={inspectionId} lang={lang} t={t} hasAssociation={hasAssociation} labels={L} onChanged={refresh} />
        ))}

        <section className="card rp-card" aria-labelledby="neg-details">
          <div className="card-body">
            <div className="rp-sechead">
              <span className="rp-sechead__icon" aria-hidden>
                <i className="bi bi-sliders" />
              </span>
              <h2 id="neg-details" className="rp-sechead__title">
                {t.rpNegDetails}
              </h2>
            </div>
            <div className="row g-3">
              {hasAssociation && (
                <div className="col-md-6">
                  <label className="form-label" htmlFor="share">
                    {t.ownerShare}
                  </label>
                  <input id="share" className="form-control" inputMode="decimal" placeholder="8,5" value={form.ownerSharePct} onChange={(e) => setForm({ ...form, ownerSharePct: e.target.value })} aria-describedby="share-help" />
                  <div id="share-help" className="form-text">
                    {t.ownerShareHelp}
                  </div>
                </div>
              )}
              <div className="col-md-6">
                <label className="form-label" htmlFor="deadline">
                  {t.deadline}
                </label>
                <input id="deadline" type="date" className="form-control" value={form.responseDeadline} onChange={(e) => setForm({ ...form, responseDeadline: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="note">
                  {t.generalNote}
                </label>
                <textarea id="note" className="form-control" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </div>
            {error && (
              <div className="rp-callout rp-callout--danger mt-3" role="alert">
                <i className="bi bi-exclamation-circle" aria-hidden />
                <div>{error}</div>
              </div>
            )}
            <div className="d-flex align-items-center gap-3 mt-3">
              <button type="button" className="btn btn-primary" disabled={saveState === "saving"} onClick={saveSettings}>
                {saveState === "saving" ? t.saving : saveState === "saved" ? `✓ ${t.saved}` : t.saveSettings}
              </button>
            </div>
          </div>
        </section>
      </div>

      <aside className="rp-split__side">
        <div className="rp-sticky">
          <section className="card rp-card rp-totals" aria-labelledby="neg-totals">
            <div className="card-body">
              <h2 id="neg-totals" className="rp-label">
                {t.totTitle}
              </h2>
              <table className="rp-totals__table">
                <tbody>
                  {rows.map(([label, value, strong]) => (
                    <tr key={label} className={strong ? "is-strong" : undefined}>
                      <th scope="row">{label}</th>
                      <td>
                        {formatIsk(value, lang)}
                        {priceIsk && (
                          <div className="rp-totals__pct">
                            {pct(value, priceIsk)} {t.ofPrice}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <details className="rp-details">
                <summary>{t.legalTitle}</summary>
                <p className="mt-2 mb-1">{LEGAL_REFERENCE.proposal2pct[lang]}</p>
                <p className="mb-0">{LEGAL_REFERENCE.caseLaw[lang]}</p>
              </details>
            </div>
          </section>

          <section className="card rp-card rp-share" aria-labelledby="neg-share">
            <div className="card-body">
              <div className="rp-sechead">
                <span className="rp-sechead__icon" aria-hidden>
                  <i className="bi bi-send" />
                </span>
                <h2 id="neg-share" className="rp-sechead__title">
                  {t.shareTitle}
                </h2>
              </div>
              <p className="rp-share__help">{t.shareHelp}</p>
              <div className="input-group mb-2">
                <input className="form-control" readOnly value={shareUrl} aria-label={t.shareTitle} />
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={async () => {
                    await navigator.clipboard?.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  <i className={`bi ${copied ? "bi-check2" : "bi-clipboard"} me-1`} aria-hidden />
                  {copied ? t.copied : t.copyLink}
                </button>
              </div>
              <Link href={`/inspections/${inspectionId}/negotiate/document`} className="btn btn-outline-secondary w-100">
                <i className="bi bi-file-earmark-text me-2" aria-hidden />
                {t.openDocument}
              </Link>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function NegotiationItem({
  item,
  inspectionId,
  lang,
  t,
  hasAssociation,
  labels,
  onChanged,
}: {
  item: NegItem;
  inspectionId: string;
  lang: Lang;
  t: Dict;
  hasAssociation: boolean;
  labels: Record<RemedyAction, string>;
  onChanged: () => void;
}) {
  const action = item.remedy?.action ?? "none";
  const [amount, setAmount] = useState(String(item.remedy?.amountIsk ?? item.estimate));
  const [remark, setRemark] = useState(item.remedy?.remark ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: RemedyAction, extra: { amountIsk?: number | null; remark?: string } = {}) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/remedies/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: next, ...extra }),
      });
      if (!res.ok) setError(await errorText(res, lang, t.error));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const actions: RemedyAction[] = ["seller_fix", "price_reduction", ...(hasAssociation ? (["hoa"] as const) : []), "accept", "none"];
  const amountNumber = () => {
    const n = Number(amount.replace(/\D/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const r = item.remedy;
  const fixKey = r ? (`fix_${r.fixStatus}` as const) : null;

  return (
    <article className="card rp-negitem" style={{ "--rp-accent": GRADE_COLOR[item.grade].solid } as CSSProperties} aria-labelledby={`neg-${item.id}`}>
      <div className="card-body">
        <div className="rp-negitem__head">
          <div className="rp-negitem__heading">
            <div className="rp-negitem__item">{item.itemTitle}</div>
            <h3 id={`neg-${item.id}`} className="rp-negitem__title">
              <GradeBadge grade={item.grade} lang={lang} compact />
              <span>{item.title}</span>
            </h3>
          </div>
          <div className="rp-negitem__est">
            <div className="rp-negitem__estlabel">{t.estimate}</div>
            <div className="rp-negitem__range">{item.costRange ?? "—"}</div>
          </div>
        </div>
        <p className="rp-negitem__desc">{item.description}</p>
        {item.likelyCommon && (
          <div className="rp-hint">
            <i className="bi bi-buildings" aria-hidden />
            {t.likelyCommon}
          </div>
        )}
        {item.photoIds.length > 0 && (
          <ul className="rp-photos rp-photos--sm">
            {item.photoIds.slice(0, 4).map((pid, i) => (
              <li key={pid}>
                <a href={`/api/photos/${pid}`} target="_blank" rel="noreferrer" className="rp-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photos/${pid}`} alt={`${t.photo} ${i + 1}`} loading="lazy" />
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="rp-choices" role="group" aria-label={t.action}>
          {actions.map((a) => (
            <button
              key={a}
              type="button"
              className={`rp-choice${action === a ? " is-active" : ""}`}
              aria-pressed={action === a}
              disabled={busy}
              onClick={() => save(a, a === "price_reduction" ? { amountIsk: amountNumber() || item.estimate } : {})}
            >
              <i className={`bi ${ACTION_ICON[a]}`} aria-hidden />
              {labels[a]}
            </button>
          ))}
        </div>

        {action !== "none" && (
          <div className="row g-3 rp-negitem__fields">
            {action === "price_reduction" && (
              <div className="col-md-5">
                <label className="form-label" htmlFor={`amount-${item.id}`}>
                  {t.amountIsk}
                </label>
                <div className="input-group">
                  <input
                    id={`amount-${item.id}`}
                    className="form-control"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={() => save("price_reduction", { amountIsk: amountNumber() })}
                  />
                  <span className="input-group-text">kr.</span>
                </div>
              </div>
            )}
            <div className={action === "price_reduction" ? "col-md-7" : "col-12"}>
              <label className="form-label" htmlFor={`remark-${item.id}`}>
                {t.remarkLabel}
              </label>
              <input
                id={`remark-${item.id}`}
                className="form-control"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                onBlur={() => remark !== (r?.remark ?? "") && save(action, { remark })}
              />
            </div>
          </div>
        )}

        {r && r.action !== "none" && (r.sellerResponse !== "none" || r.fixStatus !== "none") && (
          <div className="rp-response">
            {r.sellerResponse !== "none" && (
              <div className="rp-response__row">
                <span className="rp-response__label">{t.sellerResponse}</span>
                <Chip tone={r.sellerResponse === "accepted" ? "success" : "danger"} icon={r.sellerResponse === "accepted" ? "bi-check2-circle" : "bi-x-circle"}>
                  {r.sellerResponse === "accepted" ? t.respAccepted : t.respDisputed}
                </Chip>
                {r.disputeReason && <span className="rp-response__reason">{t[`reason_${r.disputeReason}`]}</span>}
              </div>
            )}
            {r.sellerResponse !== "none" && r.sellerComment && <blockquote className="rp-quote">“{r.sellerComment}”</blockquote>}
            {r.action === "seller_fix" && fixKey && r.fixStatus !== "none" && (
              <div className="rp-response__fix">
                <FixBadge status={r.fixStatus} t={t} />
                {r.fixVerdict && <p className="rp-response__verdict">{r.fixVerdict.explanation}</p>}
                {item.afterPhotoIds.length > 0 && (
                  <ul className="rp-photos rp-photos--sm">
                    {item.afterPhotoIds.map((pid, i) => (
                      <li key={pid}>
                        <a href={`/api/photos/${pid}`} target="_blank" rel="noreferrer" className="rp-photo">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/photos/${pid}`} alt={`${t.after} ${i + 1}`} loading="lazy" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        {error && (
          <div className="rp-callout rp-callout--danger mt-3" role="alert">
            <i className="bi bi-exclamation-circle" aria-hidden />
            <div>{error}</div>
          </div>
        )}
      </div>
    </article>
  );
}

const FIX_TONE: Record<Remedy["fixStatus"], ChipTone> = {
  none: "neutral",
  submitted: "info",
  fixed: "success",
  partially_fixed: "warning",
  not_fixed: "danger",
  cannot_tell: "neutral",
};

export function FixBadge({ status, t }: { status: Remedy["fixStatus"]; t: Dict }) {
  return (
    <Chip tone={FIX_TONE[status]} icon="bi-tools">
      {t[`fix_${status}`]}
    </Chip>
  );
}
