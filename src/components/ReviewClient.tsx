"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import FindingView from "./FindingView";
import { Chip, SegBar, Swatch, describeParts, type SegPart } from "./report/ui";
import { COST_CATALOG } from "@/lib/costs";
import { getDict, type Dict } from "@/lib/i18n";
import { FOLLOW_UP_LABEL, GRADE_INFO, URGENCY_LABEL } from "@/lib/labels";
import {
  FOLLOW_UPS,
  GRADES,
  URGENCIES,
  type Finding,
  type FollowUp,
  type Grade,
  type Lang,
  type Urgency,
} from "@/lib/types";

export interface ReviewItem {
  key: string;
  title: string;
  notes: string;
  skipped: boolean;
  itemSummary: string | null;
  photoIds: string[];
  /** Photos picked from the device library instead of taken live in the app. */
  libraryPhotoIds: string[];
  findings: Finding[];
}

interface Props {
  inspectionId: string;
  lang: Lang;
  items: ReviewItem[];
  defaultStatement: string;
}

type Draft = {
  title: string;
  description: string;
  grade: Grade;
  recommendedAction: string;
  followUp: FollowUp;
  urgency: Urgency;
  costKey: string;
  inspectorNote: string;
};

const draftOf = (f: Finding): Draft => ({
  title: f.title,
  description: f.description,
  grade: f.grade,
  recommendedAction: f.recommendedAction,
  followUp: f.followUp,
  urgency: f.urgency,
  costKey: f.costKey,
  inspectorNote: f.inspectorNote,
});

const EMPTY: Draft = {
  title: "",
  description: "",
  grade: "TG2",
  recommendedAction: "",
  followUp: "none",
  urgency: "within_1y",
  costKey: "none",
  inspectorNote: "",
};

async function errorText(res: Response, lang: Lang, fallback: string) {
  try {
    const body = await res.json();
    return (body?.error?.[lang] as string | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function ReviewClient({ inspectionId, lang, items, defaultStatement }: Props) {
  const t = getDict(lang);
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const pendingCount = items.flatMap((i) => i.findings).filter((f) => f.reviewStatus === "pending").length;
  const [sign, setSign] = useState({ name: "", license: "", statement: defaultStatement });
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  async function doSign() {
    setSigning(true);
    setSignError(null);
    try {
      const res = await fetch(`/api/inspector/inspections/${inspectionId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sign),
      });
      if (!res.ok) {
        setSignError(await errorText(res, lang, t.error));
        return;
      }
      router.push(`/inspections/${inspectionId}/report`);
    } finally {
      setSigning(false);
    }
  }

  // Review progress (derived from the findings, display only).
  const all = items.flatMap((i) => i.findings);
  const progress: SegPart[] = [
    { key: "confirmed", label: t.confirmed, value: all.filter((f) => f.reviewStatus === "confirmed").length, color: "var(--grade-0)" },
    { key: "edited", label: t.edited, value: all.filter((f) => f.reviewStatus === "edited").length, color: "var(--brand)" },
    { key: "rejected", label: t.rejected, value: all.filter((f) => f.reviewStatus === "rejected").length, color: "var(--grade-iu)" },
    { key: "pending", label: t.pending, value: pendingCount, color: "var(--grade-1)" },
  ];

  return (
    <div className="rp-review">
      <div className="rp-review__items">
        {items.map((item) => {
          const compact = item.photoIds.length === 0 && item.findings.length === 0 && !item.notes && !item.itemSummary;
          return (
            <section className={`card rp-ritem${compact ? " rp-ritem--compact" : ""}`} key={item.key} aria-labelledby={`rv-${item.key}`}>
              <div className="card-body">
                <header className="rp-ritem__head">
                  <h2 id={`rv-${item.key}`} className="rp-ritem__title">
                    {item.title}
                  </h2>
                  <div className="rp-ritem__chips">
                    {item.skipped && (
                      <Chip tone="neutral" icon="bi-slash-circle">
                        {t.notAccessible}
                      </Chip>
                    )}
                    {item.photoIds.length > 0 && (
                      <Chip tone="outline" icon="bi-images">
                        {t.photosForItem}: {item.photoIds.length}
                      </Chip>
                    )}
                  </div>
                </header>
                {item.notes && (
                  <div className="rp-ritem__notes">
                    <i className="bi bi-chat-left-text" aria-hidden />
                    <em>{item.notes}</em>
                  </div>
                )}
                {item.photoIds.length > 0 && (
                  <ul className="rp-photos rp-photos--lg" aria-label={t.photosForItem}>
                    {item.photoIds.map((pid, i) => (
                      <li key={pid}>
                        <a href={`/api/photos/${pid}`} target="_blank" rel="noreferrer" className="rp-photo">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/photos/${pid}`} alt={`${t.photo} ${i + 1}`} loading="lazy" />
                          <span className="rp-photo__num" aria-hidden>
                            {i + 1}
                          </span>
                          {item.libraryPhotoIds.includes(pid) && (
                            <span className="rp-photo__flag" title={t.libraryPhotoHint}>
                              <i className="bi bi-images" aria-label={t.fromLibrary} />
                            </span>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {item.itemSummary && (
                  <p className="rp-ritem__summary">
                    <i className="bi bi-stars" aria-hidden />
                    {item.itemSummary}
                  </p>
                )}
                {item.findings.length > 0 && (
                  <div className="rp-ritem__findings">
                    {item.findings.map((f) => (
                      <FindingEditor
                        key={f.id}
                        finding={f}
                        lang={lang}
                        t={t}
                        photoNumbers={f.photoIds.map((pid) => item.photoIds.indexOf(pid) + 1).filter((n) => n > 0)}
                        onChanged={refresh}
                      />
                    ))}
                  </div>
                )}
                <AddFinding inspectionId={inspectionId} itemKey={item.key} lang={lang} t={t} onAdded={refresh} />
              </div>
            </section>
          );
        })}
      </div>

      <aside className="rp-review__side">
        <div className="rp-sticky">
          <section className="card rp-card" aria-labelledby="rv-progress">
            <div className="card-body">
              <h2 id="rv-progress" className="rp-label">
                {t.rpReviewProgress}
              </h2>
              <div className="rp-progress">
                <span className="rp-progress__value">{all.length - pendingCount}</span>
                <span className="rp-progress__of">/ {all.length}</span>
              </div>
              <SegBar parts={progress} ariaLabel={`${t.rpReviewProgress}: ${describeParts(progress)}`} />
              <ul className="rp-keys rp-keys--stack">
                {progress.map((p) => (
                  <li key={p.key}>
                    <Swatch color={p.color} />
                    <span className="flex-grow-1">{p.label}</span>
                    <strong>{p.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="card rp-card rp-signpanel" aria-labelledby="rv-sign">
            <div className="card-body">
              <div className="rp-signpanel__head">
                <span className="rp-sechead__icon" aria-hidden>
                  <i className="bi bi-pen" />
                </span>
                <h2 id="rv-sign" className="rp-sechead__title">
                  {t.signTitle}
                </h2>
              </div>
              {pendingCount > 0 && (
                <div className="rp-callout rp-callout--warning mb-3" role="status">
                  <i className="bi bi-hourglass-split" aria-hidden />
                  <div>
                    {pendingCount} {t.unpendingCount}
                  </div>
                </div>
              )}
              <div className="mb-3">
                <label className="form-label" htmlFor="signName">
                  {t.signName}
                </label>
                <input id="signName" className="form-control" value={sign.name} onChange={(e) => setSign({ ...sign, name: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="signLicense">
                  {t.signLicense}
                </label>
                <input id="signLicense" className="form-control" value={sign.license} onChange={(e) => setSign({ ...sign, license: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="signStatement">
                  {t.signStatement}
                </label>
                <textarea id="signStatement" className="form-control" rows={4} value={sign.statement} onChange={(e) => setSign({ ...sign, statement: e.target.value })} />
              </div>
              {signError && (
                <div className="rp-callout rp-callout--danger mb-3" role="alert">
                  <i className="bi bi-exclamation-circle" aria-hidden />
                  <div>{signError}</div>
                </div>
              )}
              <button type="button" className="btn btn-primary btn-lg w-100" disabled={signing || pendingCount > 0 || !sign.name || !sign.license} onClick={doSign}>
                {signing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden />
                    {t.signing}
                  </>
                ) : (
                  <>
                    <i className="bi bi-patch-check me-2" aria-hidden />
                    {t.signBtn}
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function FindingFields({ draft, setDraft, t, lang }: { draft: Draft; setDraft: (d: Draft) => void; t: Dict; lang: Lang }) {
  const id = useId();
  return (
    <div className="row g-3 rp-fields">
      <div className="col-md-8">
        <label className="form-label" htmlFor={`${id}-title`}>
          {t.title}
        </label>
        <input id={`${id}-title`} className="form-control form-control-sm" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${id}-grade`}>
          {t.grade}
        </label>
        <select id={`${id}-grade`} className="form-select form-select-sm" value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value as Grade })}>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {GRADE_INFO[g].short} · {GRADE_INFO[g].label[lang]}
            </option>
          ))}
        </select>
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={`${id}-description`}>
          {t.description}
        </label>
        <textarea id={`${id}-description`} className="form-control form-control-sm" rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={`${id}-action`}>
          {t.action}
        </label>
        <input id={`${id}-action`} className="form-control form-control-sm" value={draft.recommendedAction} onChange={(e) => setDraft({ ...draft, recommendedAction: e.target.value })} />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${id}-followUp`}>
          {t.followUp}
        </label>
        <select id={`${id}-followUp`} className="form-select form-select-sm" value={draft.followUp} onChange={(e) => setDraft({ ...draft, followUp: e.target.value as FollowUp })}>
          {FOLLOW_UPS.map((f) => (
            <option key={f} value={f}>
              {FOLLOW_UP_LABEL[f][lang]}
            </option>
          ))}
        </select>
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${id}-urgency`}>
          {t.urgency}
        </label>
        <select id={`${id}-urgency`} className="form-select form-select-sm" value={draft.urgency} onChange={(e) => setDraft({ ...draft, urgency: e.target.value as Urgency })}>
          {URGENCIES.map((u) => (
            <option key={u} value={u}>
              {URGENCY_LABEL[u][lang]}
            </option>
          ))}
        </select>
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor={`${id}-costKey`}>
          {t.costKey}
        </label>
        <select id={`${id}-costKey`} className="form-select form-select-sm" value={draft.costKey} onChange={(e) => setDraft({ ...draft, costKey: e.target.value })}>
          <option value="none">—</option>
          {Object.entries(COST_CATALOG).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label[lang]}
            </option>
          ))}
        </select>
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={`${id}-inspectorNote`}>
          {t.inspectorNote}
        </label>
        <input id={`${id}-inspectorNote`} className="form-control form-control-sm" value={draft.inspectorNote} onChange={(e) => setDraft({ ...draft, inspectorNote: e.target.value })} />
      </div>
    </div>
  );
}

function FindingEditor({
  finding,
  lang,
  t,
  photoNumbers,
  onChanged,
}: {
  finding: Finding;
  lang: Lang;
  t: Dict;
  photoNumbers: number[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(draftOf(finding));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Partial<Draft> & { reviewStatus?: "confirmed" | "edited" | "rejected" }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspector/findings/${finding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await errorText(res, lang, t.error));
        return;
      }
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/inspector/findings/${finding.id}`, { method: "DELETE" });
      if (!res.ok) setError(await errorText(res, lang, t.error));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const statusBadge =
    finding.reviewStatus === "pending" ? (
      <Chip tone="warning" icon="bi-hourglass-split">
        {t.pending}
      </Chip>
    ) : finding.reviewStatus === "confirmed" ? (
      <Chip tone="success" icon="bi-check2-circle">
        {t.confirmed}
      </Chip>
    ) : finding.reviewStatus === "edited" ? (
      <Chip tone="brand" icon="bi-pencil">
        {t.edited}
      </Chip>
    ) : (
      <Chip tone="neutral" icon="bi-x-circle">
        {t.rejected}
      </Chip>
    );

  return (
    <div className={`rp-reditor${editing ? " is-editing" : ""}`}>
      <FindingView finding={finding} lang={lang} photoNumbers={photoNumbers} showSource />
      {editing && (
        <div className="rp-reditor__form">
          <FindingFields draft={draft} setDraft={setDraft} t={t} lang={lang} />
        </div>
      )}
      {error && (
        <div className="rp-callout rp-callout--danger rp-reditor__error" role="alert">
          <i className="bi bi-exclamation-circle" aria-hidden />
          <div>{error}</div>
        </div>
      )}
      <div className="rp-reditor__bar">
        <div>{statusBadge}</div>
        <div className="rp-reditor__actions">
          {editing ? (
            <>
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => setEditing(false)}>
                {t.rpCancel}
              </button>
              <button type="button" className="btn btn-sm btn-primary" disabled={busy || !draft.title} onClick={() => send({ ...draft })}>
                <i className="bi bi-check2 me-1" aria-hidden />
                {t.save}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => send({ reviewStatus: "confirmed" })}>
                <i className="bi bi-check2 me-1" aria-hidden />
                {t.confirm}
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => setEditing(true)}>
                <i className="bi bi-pencil me-1" aria-hidden />
                {t.edit}
              </button>
              {finding.source === "ai" ? (
                <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => send({ reviewStatus: "rejected" })}>
                  <i className="bi bi-x-lg me-1" aria-hidden />
                  {t.reject}
                </button>
              ) : (
                <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={remove} aria-label={t.rpDeleteFinding} title={t.rpDeleteFinding}>
                  <i className="bi bi-trash" aria-hidden />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AddFinding({ inspectionId, itemKey, lang, t, onAdded }: { inspectionId: string; itemKey: string; lang: Lang; t: Dict; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspector/inspections/${inspectionId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, itemKey }),
      });
      if (!res.ok) {
        setError(await errorText(res, lang, t.error));
        return;
      }
      setDraft(EMPTY);
      setOpen(false);
      onAdded();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-sm rp-addbtn" onClick={() => setOpen(true)}>
        <i className="bi bi-plus-lg me-1" aria-hidden />
        {t.addFinding}
      </button>
    );
  }
  return (
    <div className="rp-addform">
      <div className="rp-addform__title">
        <i className="bi bi-plus-circle" aria-hidden />
        {t.addFinding}
      </div>
      <FindingFields draft={draft} setDraft={setDraft} t={t} lang={lang} />
      {error && (
        <div className="rp-callout rp-callout--danger mt-3" role="alert">
          <i className="bi bi-exclamation-circle" aria-hidden />
          <div>{error}</div>
        </div>
      )}
      <div className="d-flex justify-content-end gap-2 mt-3">
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(false)}>
          {t.rpCancel}
        </button>
        <button type="button" className="btn btn-sm btn-primary" disabled={busy || !draft.title} onClick={add}>
          <i className="bi bi-plus-lg me-1" aria-hidden />
          {t.addFinding}
        </button>
      </div>
    </div>
  );
}
