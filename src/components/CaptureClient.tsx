"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import FindingView from "./FindingView";
import { resizeForUpload } from "@/lib/client/image";
import { getDict, type Dict } from "@/lib/i18n";
import { PHOTO_ISSUE_ADVICE } from "@/lib/labels";
import { PLANS } from "@/lib/pricing";
import type { Finding, ItemAnalysisRecord, ItemStatus, Lang, Tier } from "@/lib/types";

export interface CaptureItem {
  key: string;
  /** Checklist area key (src/lib/checklist.ts), used for the section icon. */
  area?: string;
  areaLabel: string;
  title: string;
  instructions: string;
  minPhotos: number;
  status: ItemStatus;
  notes: string;
  notAccessible: boolean;
  /** Why the item can't be assessed (the standard requires one when notAccessible). */
  naReason: string;
  analysis: ItemAnalysisRecord | null;
  photoIds: string[];
  /** Result of the instant photo check (fast model), by photo id. */
  photoChecks: Record<string, { status: "unchecked" | "ok" | "retake"; reason: string | null }>;
  findings: Finding[];
  focus: string[];
}

interface Props {
  inspectionId: string;
  lang: Lang;
  tier: Tier;
  address: string;
  /** e.g. "Íbúð í fjölbýli · Byggt 1972 · 85 m² · Steinsteypt" */
  propertyLine?: string;
  items: CaptureItem[];
  focusNotes: string[];
  demo: boolean;
  missingTitles: string[];
  /** Item keys matching missingTitles, so the hint can link to each item. */
  missingKeys?: string[];
}

const AREA_ICON: Record<string, string> = {
  exterior: "bi-house",
  interior: "bi-door-open",
  wet: "bi-droplet",
  systems: "bi-lightning-charge",
  documents: "bi-file-earmark-text",
};

async function errorText(res: Response, lang: Lang, fallback: string) {
  try {
    const body = await res.json();
    return (body?.error?.[lang] as string | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function CaptureClient(props: Props) {
  const { inspectionId, lang, tier, address, propertyLine, items, focusNotes, demo, missingTitles, missingKeys } = props;
  const t = getDict(lang);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const required = items.filter((i) => i.minPhotos > 0);
  const done = required.filter((i) => i.status === "analyzed" || i.status === "skipped").length;
  const pct = required.length ? Math.round((done / required.length) * 100) : 100;
  const analyzedCount = required.filter((i) => i.status === "analyzed").length;
  const skippedCount = required.filter((i) => i.status === "skipped").length;
  const share = (n: number) => (required.length ? (n / required.length) * 100 : 0);
  const plan = PLANS.find((p) => p.key === tier);

  // Consecutive items with the same area form one section.
  const sections: { label: string; area?: string; items: CaptureItem[] }[] = [];
  for (const item of items) {
    const last = sections[sections.length - 1];
    if (last && last.label === item.areaLabel) last.items.push(item);
    else sections.push({ label: item.areaLabel, area: item.area, items: [item] });
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/inspections/${inspectionId}/submit`, { method: "POST" });
      if (!res.ok) {
        setSubmitError(await errorText(res, lang, t.error));
        return;
      }
      if (tier === "basic") router.push(`/inspections/${inspectionId}/report`);
      else router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sh-page sh-fill sh-capture bg-surface-2">
      <div className="container sh-capture-container">
        <header className="sh-cap-head">
          <div className="sh-cap-head-top">
            <p className="eyebrow mb-0">
              <i className="bi bi-camera me-2" aria-hidden />
              {t.captureTitle}
            </p>
            {plan && <span className="sh-cap-tier">{plan.name[lang]}</span>}
          </div>
          <h1 className="sh-cap-title">{address}</h1>
          {propertyLine && <p className="sh-cap-meta">{propertyLine}</p>}

          <div className="sh-cap-progress">
            <div className="sh-cap-progress-top">
              <p className="sh-cap-count">
                <strong>{done}</strong>
                <span className="sh-cap-count-total">/{required.length}</span> {t.progress}
              </p>
              <span className="sh-cap-pct">{pct}%</span>
            </div>
            <div
              className="sh-progress"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${done}/${required.length} ${t.progress}`}
            >
              <div className="sh-progress-bar is-analyzed" style={{ width: `${share(analyzedCount)}%` }} />
              <div className="sh-progress-bar is-skipped" style={{ width: `${share(skippedCount)}%` }} />
            </div>
            <ul className="sh-cap-legend">
              <li>
                <span className="sh-dot is-analyzed" aria-hidden />
                {t.shStatusAnalyzed} <strong>{analyzedCount}</strong>
              </li>
              <li>
                <span className="sh-dot is-skipped" aria-hidden />
                {t.shStatusSkipped} <strong>{skippedCount}</strong>
              </li>
              <li>
                <span className="sh-dot is-pending" aria-hidden />
                {t.shStatusPending} <strong>{required.length - done}</strong>
              </li>
            </ul>
          </div>
        </header>

        {demo && (
          <div className="sh-callout sh-callout-warn" role="status">
            <i className="bi bi-exclamation-triangle" aria-hidden />
            <div>{t.demoBanner}</div>
          </div>
        )}

        {focusNotes.length > 0 && (
          <div className="sh-callout sh-callout-info">
            <i className="bi bi-lightbulb" aria-hidden />
            <div>
              <p className="sh-callout-title">{t.focusTitle}</p>
              <ul className="sh-callout-list">
                {focusNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {sections.map((s, si) => {
          const req = s.items.filter((i) => i.minPhotos > 0);
          const reqDone = req.filter((i) => i.status === "analyzed" || i.status === "skipped").length;
          return (
            <section className="sh-cap-section" key={`${s.label}-${si}`} aria-labelledby={`area-${si}`}>
              <div className="sh-cap-section-head">
                <span className="sh-cap-section-icon" aria-hidden>
                  <i className={`bi ${(s.area && AREA_ICON[s.area]) || "bi-grid"}`} />
                </span>
                <h2 className="sh-cap-section-title" id={`area-${si}`}>
                  {s.label}
                </h2>
                {req.length > 0 && (
                  <span className={`sh-cap-section-count${reqDone === req.length ? " is-complete" : ""}`}>
                    {reqDone === req.length && <i className="bi bi-check-lg me-1" aria-hidden />}
                    {reqDone}/{req.length}
                  </span>
                )}
              </div>
              <div className="sh-cap-items">
                {s.items.map((item) => (
                  <ItemCard key={item.key} inspectionId={inspectionId} item={item} lang={lang} t={t} />
                ))}
              </div>
            </section>
          );
        })}

        <div className="sh-dock no-print">
          <div className="sh-dock-info">
            {missingTitles.length > 0 ? (
              <details className="sh-missing">
                <summary>
                  <span className="sh-missing-count">{missingTitles.length}</span>
                  <span className="sh-missing-text">
                    <span className="sh-missing-label">{t.missingItems}</span>
                    <span className="sh-missing-names">: {missingTitles.join(", ")}</span>
                  </span>
                  <i className="bi bi-chevron-up sh-missing-chevron" aria-hidden />
                </summary>
                <ul className="sh-missing-list">
                  {missingTitles.map((title, i) => (
                    <li key={`${title}-${i}`}>
                      {missingKeys?.[i] ? (
                        <a href={`#item-${missingKeys[i]}`}>
                          {title}
                          <i className="bi bi-arrow-up-right" aria-hidden />
                        </a>
                      ) : (
                        <span>{title}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <p className="sh-dock-ready">
                <i className="bi bi-check-circle-fill" aria-hidden />
                {done}/{required.length} {t.progress}
              </p>
            )}
            {submitError && (
              <div className="sh-callout sh-callout-danger sh-dock-error" role="alert">
                <i className="bi bi-exclamation-circle" aria-hidden />
                <div>{submitError}</div>
              </div>
            )}
          </div>
          <button type="button" className="btn btn-primary btn-lg sh-dock-btn" disabled={missingTitles.length > 0 || submitting} onClick={submit}>
            {submitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden />}
            {submitting ? t.submitting : tier === "basic" ? t.submitBasic : t.submitVerified}
            {!submitting && <i className={`bi ${tier === "basic" ? "bi-file-earmark-text" : "bi-send"} ms-2`} aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ inspectionId, item, lang, t }: { inspectionId: string; item: CaptureItem; lang: Lang; t: Dict }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(item.notes);
  const [checking, setChecking] = useState<Set<string>>(new Set());

  const refresh = () => startRefresh(() => router.refresh());
  const busy = !!uploading || analyzing || refreshing;
  const stale = item.status === "pending" && !!item.analysis;
  const numberOf = (photoId: string) => item.photoIds.indexOf(photoId) + 1;

  async function onFiles(files: FileList | null, source: "camera" | "upload") {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files);
    const uploaded: string[] = [];
    setUploading({ done: 0, total: list.length });
    try {
      for (let i = 0; i < list.length; i++) {
        const blob = await resizeForUpload(list[i]);
        const fd = new FormData();
        fd.append("file", blob, "photo.jpg");
        fd.append("source", source);
        const res = await fetch(`/api/inspections/${inspectionId}/items/${item.key}/photos`, { method: "POST", body: fd });
        if (!res.ok) {
          setError(await errorText(res, lang, t.error));
          break;
        }
        uploaded.push(((await res.json()) as { id: string }).id);
        setUploading({ done: i + 1, total: list.length });
      }
    } finally {
      setUploading(null);
      if (cameraInput.current) cameraInput.current.value = "";
      if (libraryInput.current) libraryInput.current.value = "";
      refresh();
    }
    // Instant feedback: a fast, cheap model checks each new photo in parallel (best effort).
    if (uploaded.length) {
      setChecking(new Set(uploaded));
      await Promise.allSettled(uploaded.map((id) => fetch(`/api/photos/${id}/check`, { method: "POST" })));
      setChecking(new Set());
      refresh();
    }
  }

  async function removePhoto(photoId: string) {
    setError(null);
    const res = await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
    if (!res.ok) setError(await errorText(res, lang, t.error));
    refresh();
  }

  async function patch(body: { notes?: string; notAccessible?: boolean; naReason?: string }) {
    setError(null);
    const res = await fetch(`/api/inspections/${inspectionId}/items/${item.key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) setError(await errorText(res, lang, t.error));
    refresh();
  }

  async function analyze() {
    setError(null);
    setAnalyzing(true);
    try {
      // Save pending notes first so the analysis sees them.
      if (notes !== item.notes) await patch({ notes });
      const res = await fetch(`/api/inspections/${inspectionId}/items/${item.key}/analyze`, { method: "POST" });
      if (!res.ok) setError(await errorText(res, lang, t.error));
    } finally {
      setAnalyzing(false);
      refresh();
    }
  }

  const state = item.status;
  const stateLabel = state === "analyzed" ? t.shStatusAnalyzed : state === "skipped" ? t.shStatusSkipped : t.shStatusPending;
  const statusIcon =
    state === "analyzed" ? (
      <i className="bi bi-check-lg" aria-hidden />
    ) : state === "skipped" ? (
      <i className="bi bi-slash-circle" aria-hidden />
    ) : (
      <i className="bi bi-camera" aria-hidden />
    );
  // Photos flagged for a retake don't count towards the minimum.
  const photoCount = item.photoIds.filter((pid) => item.photoChecks[pid]?.status !== "retake").length;
  const retakeCount = item.photoIds.filter((pid) => item.photoChecks[pid]?.status === "retake").length;

  return (
    <article id={`item-${item.key}`} className={`sh-item is-${state}${analyzing ? " is-analyzing" : ""}`}>
      {analyzing && <span className="sh-scan" aria-hidden />}
      <header className="sh-item-head">
        <span className={`sh-item-status is-${state}`} aria-hidden>
          {statusIcon}
        </span>
        <div className="sh-item-heading">
          <h3 className="sh-item-title">{item.title}</h3>
          <div className="sh-item-meta">
            <span className={`sh-state is-${state}`}>{stateLabel}</span>
            {item.notAccessible && !item.naReason.trim() && (
              <span className="sh-chip std-chip-warn">
                <i className="bi bi-exclamation-circle" aria-hidden />
                {t.stdNaNeeded}
              </span>
            )}
            {item.minPhotos > 0 ? (
              <span className={`sh-chip${photoCount >= item.minPhotos ? " is-met" : ""}`} title={`${t.minPhotos}: ${item.minPhotos}`}>
                <i className={`bi ${photoCount >= item.minPhotos ? "bi-check2" : "bi-images"}`} aria-hidden />
                {t.minPhotos}: {item.minPhotos}
              </span>
            ) : (
              <span className="sh-chip">{t.optional}</span>
            )}
          </div>
        </div>
      </header>

      <div className="sh-item-body">
      <p className="sh-item-guide">{item.instructions}</p>
      {item.focus.length > 0 && (
        <ul className="sh-item-focus">
          {item.focus.map((f) => (
            <li key={f}>
              <i className="bi bi-lightbulb" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {!item.notAccessible && (
        <>
          <div className="sh-photos">
            {item.photoIds.map((pid, i) => {
              const retake = item.photoChecks[pid]?.status === "retake";
              return (
                <div className={`sh-photo${retake ? " is-retake" : ""}`} key={pid}>
                  <a href={`/api/photos/${pid}`} target="_blank" rel="noreferrer" className="sh-photo-link">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photos/${pid}`} alt={`${t.photo} ${i + 1}`} loading="lazy" />
                  </a>
                  {checking.has(pid) && (
                    <span className="sh-photo-checking" title={t.checkingPhoto}>
                      <span className="spinner-border spinner-border-sm" aria-label={t.checkingPhoto} />
                    </span>
                  )}
                  <span className="sh-photo-num">{i + 1}</span>
                  {retake && (
                    <span className="sh-photo-flag" title={t.photoRetake}>
                      <i className="bi bi-exclamation-lg" aria-hidden />
                    </span>
                  )}
                  <button type="button" className="sh-photo-del" aria-label={`${t.deletePhoto} ${i + 1}`} disabled={busy} onClick={() => removePhoto(pid)}>
                    <i className="bi bi-x-lg" aria-hidden />
                  </button>
                </div>
              );
            })}
            {/* Live camera capture is the preferred evidence; library uploads are marked for the inspector. */}
            <label className={`sh-add is-camera${busy ? " is-disabled" : ""}`}>
              <i className="bi bi-camera" aria-hidden />
              <span>{uploading ? `${uploading.done}/${uploading.total}` : t.takePhoto}</span>
              <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="visually-hidden"
                disabled={busy}
                onChange={(e) => onFiles(e.target.files, "camera")}
              />
            </label>
            <label className={`sh-add is-library${busy ? " is-disabled" : ""}`}>
              <i className="bi bi-images" aria-hidden />
              <span>{t.fromLibrary}</span>
              <input
                ref={libraryInput}
                type="file"
                accept="image/*"
                multiple
                className="visually-hidden"
                disabled={busy}
                onChange={(e) => onFiles(e.target.files, "upload")}
              />
            </label>
          </div>

          {retakeCount > 0 && (
            <div className="sh-callout sh-callout-warn">
              <i className="bi bi-camera" aria-hidden />
              <div>
                <p className="sh-callout-title">{t.photoRetake}</p>
                <ul className="sh-callout-list">
                  {item.photoIds.map((pid, i) =>
                    item.photoChecks[pid]?.status === "retake" ? (
                      <li key={pid}>
                        <strong>
                          {t.photo} {i + 1}:
                        </strong>{" "}
                        {PHOTO_ISSUE_ADVICE[item.photoChecks[pid].reason ?? "other"]?.[lang] ?? t.photoRetake}
                      </li>
                    ) : null,
                  )}
                </ul>
              </div>
            </div>
          )}

          <textarea
            className="form-control sh-notes"
            rows={2}
            placeholder={t.notes}
            aria-label={t.notes}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== item.notes && patch({ notes })}
            disabled={busy}
          />
        </>
      )}

      <div className="sh-item-actions">
        {!item.notAccessible && (
          <button type="button" className="btn btn-primary sh-analyze" disabled={busy || item.photoIds.length === 0} onClick={analyze}>
            {analyzing ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" aria-hidden />
                {t.analyzing}
                <Elapsed />
              </>
            ) : item.analysis ? (
              <>
                <i className="bi bi-arrow-repeat me-2" aria-hidden />
                {t.reanalyze}
              </>
            ) : (
              <>
                <i className="bi bi-stars me-2" aria-hidden />
                {t.analyze}
              </>
            )}
          </button>
        )}
        <div className="form-check form-switch sh-na mb-0">
          <input
            id={`na-${item.key}`}
            type="checkbox"
            role="switch"
            className="form-check-input"
            checked={item.notAccessible}
            disabled={busy}
            onChange={(e) => patch({ notAccessible: e.target.checked })}
          />
          <label className="form-check-label" htmlFor={`na-${item.key}`}>
            {t.notAccessible}
          </label>
        </div>
      </div>

      {item.notAccessible && <NaReason item={item} t={t} busy={busy} onSave={(naReason) => patch({ naReason })} />}

      {analyzing && (
        <p className="sh-analyzing-hint" role="status">
          <span className="sh-ai-badge">{t.aiFinding}</span>
          {t.analyzingHint}
        </p>
      )}
      {error && (
        <div className="sh-callout sh-callout-danger" role="alert">
          <i className="bi bi-exclamation-circle" aria-hidden />
          <div>{error}</div>
        </div>
      )}

      {item.analysis && !item.notAccessible && (
        <div className="sh-result">
          {stale && (
            <div className="sh-callout sh-callout-muted">
              <i className="bi bi-arrow-repeat" aria-hidden />
              <div>{t.stale}</div>
            </div>
          )}
          {item.analysis.retakeRequests.length > 0 && (
            <div className="sh-callout sh-callout-warn">
              <i className="bi bi-camera" aria-hidden />
              <div>
                <p className="sh-callout-title">{t.retakeTitle}</p>
                <ul className="sh-callout-list">
                  {item.analysis.retakeRequests.map((r, i) => (
                    <li key={i}>
                      {r.photoNumber ? `${t.photo} ${r.photoNumber}: ` : ""}
                      {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {item.analysis.privacyFlags.length > 0 && (
            <div className="sh-callout sh-callout-danger">
              <i className="bi bi-shield-exclamation" aria-hidden />
              <div>
                <p className="sh-callout-title">{t.privacyTitle}</p>
                <ul className="sh-callout-list">
                  {item.analysis.privacyFlags.map((p, i) => (
                    <li key={i}>
                      {t.photo} {p.photoNumber}: {p.issue}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {item.analysis.itemSummary && (
            <p className="sh-result-summary">
              <span className="sh-ai-badge">{t.aiFinding}</span>
              <span>{item.analysis.itemSummary}</span>
            </p>
          )}
          {item.findings.length === 0 ? (
            <p className="sh-result-empty">{t.noFindings}</p>
          ) : (
            <div className="sh-findings">
              {item.findings.map((f) => (
                <FindingView key={f.id} finding={f} lang={lang} photoNumbers={f.photoIds.map(numberOf).filter((n) => n > 0)} />
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </article>
  );
}

/** m:ss since mount. Shown while an analysis runs, so a slow request doesn't look frozen. */
function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="ms-1" style={{ fontVariantNumeric: "tabular-nums" }}>
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}

/** The standard: an item that can't be assessed needs a reason, shown in the report. Quick picks or free text. */
function NaReason({ item, t, busy, onSave }: { item: CaptureItem; t: Dict; busy: boolean; onSave: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState(item.naReason);
  const picks = [t.stdNaLocked, t.stdNaNotApplicable, t.stdNaCovered, t.stdNaUnsafe];
  // Typing then clicking a quick pick fires blur and click: send the saves in order so the last choice wins.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const saved = useRef(item.naReason.trim());
  const save = (value: string) => {
    setReason(value);
    queue.current = queue.current.then(async () => {
      if (value.trim() === saved.current) return;
      saved.current = value.trim();
      await onSave(value);
    });
  };
  return (
    <div className={`std-na${reason.trim() ? "" : " is-missing"}`}>
      <label className="form-label" htmlFor={`nar-${item.key}`}>
        {t.stdNaLabel}
      </label>
      <div className="std-na__picks" role="group" aria-label={t.stdNaLabel}>
        {picks.map((p) => (
          <button key={p} type="button" className={`std-na__pick${reason === p ? " is-on" : ""}`} aria-pressed={reason === p} disabled={busy} onClick={() => save(p)}>
            {p}
          </button>
        ))}
      </div>
      <input
        id={`nar-${item.key}`}
        className="form-control form-control-sm"
        placeholder={t.stdNaPh}
        value={reason}
        maxLength={500}
        disabled={busy}
        onChange={(e) => setReason(e.target.value)}
        onBlur={() => save(reason)}
      />
    </div>
  );
}
