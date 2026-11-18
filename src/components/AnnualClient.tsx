"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import GradeBadge from "./GradeBadge";
import { Chip } from "./report/ui";
import { FOLLOWUP_VERDICT_LABEL, isContradicted } from "@/lib/annual";
import { resizeForUpload } from "@/lib/client/image";
import { getDict, type Dict } from "@/lib/i18n";
import type { FollowUpAnswer, FollowUpVerdict, Grade, Lang, QuestionAnswer } from "@/lib/types";

export interface AnnualFollowUpView {
  findingId: string;
  title: string;
  description: string;
  itemTitle: string;
  grade: Grade;
  fromOwner: boolean;
  /** Formatted on the server: browsers differ in locale data and time zone, which breaks hydration. */
  recordedAtText: string;
  beforePhotoIds: string[];
  afterPhotoIds: string[];
  answer: FollowUpAnswer | null;
  note: string;
  verdict: FollowUpVerdict | null;
}

export interface AnnualQuestionView {
  id: string;
  text: string;
  problemAnswer: "yes" | "no";
  answer: QuestionAnswer | null;
  note: string;
  photoIds: string[];
}

interface Props {
  annualId: string;
  lang: Lang;
  followups: AnnualFollowUpView[];
  questions: AnnualQuestionView[];
}

async function errorText(res: Response, lang: Lang, fallback: string) {
  try {
    const body = await res.json();
    return (body?.error?.[lang] as string | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

/** The owner's yearly check: open items first (answer + new photo + AI comparison), then ten questions. */
export default function AnnualClient({ annualId, lang, followups, questions }: Props) {
  const t = getDict(lang);
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Photo comparisons still running: submitting now would lock the check before their verdicts land.
  const [comparing, setComparing] = useState(0);
  const onComparing = (delta: number) => setComparing((n) => Math.max(0, n + delta));

  const total = followups.length + questions.length;
  const answered = followups.filter((f) => f.answer).length + questions.filter((q) => q.answer).length;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspections/${annualId}/annual/submit`, { method: "POST" });
      if (!res.ok) {
        setError(await errorText(res, lang, t.error));
        return;
      }
      window.scrollTo({ top: 0 });
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ann">
      <section className="card rp-card" aria-labelledby="ann-follow">
        <div className="card-body">
          <h2 id="ann-follow" className="ann__h">
            <i className="bi bi-arrow-repeat" aria-hidden />
            {t.annFollowTitle}
            <span className="ann__count">{followups.length}</span>
          </h2>
          {followups.length ? (
            <>
              <p className="ann__lead">{t.annFollowLead}</p>
              <ol className="ann__list">
                {followups.map((f) => (
                  <li key={f.findingId}>
                    <FollowUpCard annualId={annualId} f={f} lang={lang} t={t} onChanged={refresh} onComparing={onComparing} />
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="ann__lead mb-0">{t.annNoOpen}</p>
          )}
        </div>
      </section>

      <section className="card rp-card" aria-labelledby="ann-q">
        <div className="card-body">
          <h2 id="ann-q" className="ann__h">
            <i className="bi bi-list-check" aria-hidden />
            {t.annQuestionsTitle}
          </h2>
          <ol className="ann__qs">
            {questions.map((q, i) => (
              <li key={q.id}>
                <QuestionRow annualId={annualId} q={q} n={i + 1} lang={lang} t={t} onChanged={refresh} />
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="ann__dock">
        <div className="ann__progress">
          <div className="ann__bar" aria-hidden>
            <span style={{ width: `${total ? (answered / total) * 100 : 100}%` }} />
          </div>
          <span>{t.annProgress.replace("{a}", String(answered)).replace("{n}", String(total))}</span>
        </div>
        {error && (
          <div className="rp-callout rp-callout--danger" role="alert">
            <i className="bi bi-exclamation-circle" aria-hidden />
            <div>{error}</div>
          </div>
        )}
        <button type="button" className="btn btn-primary btn-lg" disabled={submitting || comparing > 0 || answered < total} onClick={submit}>
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" aria-hidden />
              {t.annSubmitting}
            </>
          ) : (
            <>
              <i className="bi bi-send-check me-2" aria-hidden />
              {t.annSubmit}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** Upload one or more photos under a key (fu:<findingId> or q:<questionId>). */
function usePhotoUpload(annualId: string, key: string, lang: Lang, t: Dict, onDone: () => void) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(files: FileList | null, source: "camera" | "upload") {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", await resizeForUpload(file), "photo.jpg");
        fd.append("source", source);
        fd.append("key", key);
        const res = await fetch(`/api/inspections/${annualId}/annual/photos`, { method: "POST", body: fd });
        if (!res.ok) {
          setError(await errorText(res, lang, t.error));
          break;
        }
      }
    } finally {
      setUploading(false);
      onDone();
    }
  }
  async function remove(photoId: string) {
    const res = await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
    if (!res.ok) setError(await errorText(res, lang, t.error));
    onDone();
  }
  return { uploading, error, setError, upload, remove };
}

function PhotoPicker({ id, t, busy, onFiles }: { id: string; t: Dict; busy: boolean; onFiles: (f: FileList | null, s: "camera" | "upload") => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const reset = () => {
    if (camera.current) camera.current.value = "";
    if (library.current) library.current.value = "";
  };
  return (
    <div className="ann__pick">
      <label className={`btn btn-sm btn-outline-primary${busy ? " disabled" : ""}`} htmlFor={`${id}-cam`}>
        <i className="bi bi-camera me-1" aria-hidden />
        {t.annTakePhoto}
      </label>
      <input
        ref={camera}
        id={`${id}-cam`}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        disabled={busy}
        onChange={(e) => {
          onFiles(e.target.files, "camera");
          reset();
        }}
      />
      <label className={`btn btn-sm btn-outline-secondary${busy ? " disabled" : ""}`} htmlFor={`${id}-lib`}>
        <i className="bi bi-images me-1" aria-hidden />
        {t.fromLibrary}
      </label>
      <input
        ref={library}
        id={`${id}-lib`}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        disabled={busy}
        onChange={(e) => {
          onFiles(e.target.files, "upload");
          reset();
        }}
      />
    </div>
  );
}

function Thumbs({ ids, label, onRemove, t }: { ids: string[]; label: string; onRemove?: (id: string) => void; t: Dict }) {
  if (!ids.length) return null;
  return (
    <ul className="ann__thumbs" aria-label={label}>
      {ids.map((pid, i) => (
        <li key={pid}>
          <a href={`/api/photos/${pid}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${pid}`} alt={`${label} ${i + 1}`} loading="lazy" />
          </a>
          {onRemove && (
            <button type="button" className="ann__thumbdel" aria-label={`${t.annDeletePhoto} ${i + 1}`} onClick={() => onRemove(pid)}>
              <i className="bi bi-x-lg" aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function FollowUpCard({
  annualId,
  f,
  lang,
  t,
  onChanged,
  onComparing,
}: {
  annualId: string;
  f: AnnualFollowUpView;
  lang: Lang;
  t: Dict;
  onChanged: () => void;
  onComparing: (delta: number) => void;
}) {
  const id = useId();
  const [note, setNote] = useState(f.note);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const photos = usePhotoUpload(annualId, `fu:${f.findingId}`, lang, t, onChanged);

  async function save(body: { answer?: FollowUpAnswer; note?: string }) {
    setBusy(true);
    photos.setError(null);
    try {
      const res = await fetch(`/api/inspections/${annualId}/annual/followups/${f.findingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) photos.setError(await errorText(res, lang, t.error));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function compare() {
    if (!f.answer) {
      photos.setError(t.annAnswerFirst);
      return;
    }
    setChecking(true);
    onComparing(1);
    photos.setError(null);
    try {
      const res = await fetch(`/api/inspections/${annualId}/annual/followups/${f.findingId}/check`, { method: "POST" });
      if (!res.ok) photos.setError(await errorText(res, lang, t.error));
      onChanged();
    } finally {
      setChecking(false);
      onComparing(-1);
    }
  }

  const options: { v: FollowUpAnswer; label: string; tone: string }[] = [
    { v: "fixed", label: t.annFixed, tone: "ok" },
    { v: "unchanged", label: t.annUnchanged, tone: "warn" },
    { v: "worse", label: t.annWorse, tone: "bad" },
  ];
  const contradicted = isContradicted(f);
  const pending = busy || photos.uploading || checking;

  return (
    <article className={`ann-fu${f.answer ? ` is-${f.answer}` : ""}`} aria-labelledby={`${id}-t`}>
      <header className="ann-fu__head">
        <GradeBadge grade={f.grade} lang={lang} />
        <div className="ann-fu__titles">
          <h3 id={`${id}-t`} className="ann-fu__title">
            {f.title}
          </h3>
          <div className="ann-fu__meta">
            {f.itemTitle} · {f.fromOwner ? t.histFromOwner : t.histFromReport} · {f.recordedAtText}
          </div>
        </div>
      </header>
      {f.description && <p className="ann-fu__desc">{f.description}</p>}

      <div className="ann-seg" role="group" aria-label={f.title}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            className={`ann-seg__btn is-${o.tone}`}
            aria-pressed={f.answer === o.v}
            disabled={pending}
            onClick={() => save({ answer: o.v })}
          >
            {o.label}
          </button>
        ))}
      </div>

      <label className="visually-hidden" htmlFor={`${id}-note`}>
        {t.inspectorNote}
      </label>
      <textarea
        id={`${id}-note`}
        className="form-control form-control-sm ann-fu__note"
        rows={2}
        placeholder={f.answer === "worse" ? t.annWorsePh : t.annNotePh}
        value={note}
        maxLength={1000}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== f.note && save({ note })}
      />

      <div className="ann-fu__photos">
        <div>
          <div className="ann-fu__plabel">{t.annBefore}</div>
          {f.beforePhotoIds.length ? <Thumbs ids={f.beforePhotoIds} label={t.annBefore} t={t} /> : <span className="ann-fu__none">—</span>}
        </div>
        <div>
          <div className="ann-fu__plabel">{t.annNow}</div>
          <Thumbs ids={f.afterPhotoIds} label={t.annNow} t={t} onRemove={pending ? undefined : photos.remove} />
          <PhotoPicker id={id} t={t} busy={pending} onFiles={photos.upload} />
        </div>
      </div>

      {f.afterPhotoIds.length > 0 && (
        <div className="ann-fu__check">
          <button type="button" className="btn btn-sm btn-primary" disabled={pending} onClick={compare}>
            {checking ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" aria-hidden />
                {t.annChecking}
              </>
            ) : (
              <>
                <i className="bi bi-stars me-1" aria-hidden />
                {t.annCheck}
              </>
            )}
          </button>
        </div>
      )}

      {f.verdict && (
        <div className={`ann-verdict is-${f.verdict.verdict}`} role="status">
          <div className="ann-verdict__head">
            <Chip tone="ai" icon="bi-stars">
              {t.annVerdict}
            </Chip>
            <strong>{FOLLOWUP_VERDICT_LABEL[f.verdict.verdict][lang]}</strong>
          </div>
          <p className="mb-0">{f.verdict.explanation}</p>
          {f.verdict.retakeRequests.length > 0 && (
            <ul className="ann-verdict__retake">
              {f.verdict.retakeRequests.map((r, i) => (
                <li key={i}>
                  {r.photoNumber ? `${t.photo} ${r.photoNumber}: ` : ""}
                  {r.reason}
                </li>
              ))}
            </ul>
          )}
          {contradicted && (
            <div className="rp-callout rp-callout--warning mt-2">
              <i className="bi bi-exclamation-triangle" aria-hidden />
              <div>{t.annContradiction}</div>
            </div>
          )}
        </div>
      )}

      {photos.error && (
        <div className="rp-callout rp-callout--danger mt-2" role="alert">
          <i className="bi bi-exclamation-circle" aria-hidden />
          <div>{photos.error}</div>
        </div>
      )}
    </article>
  );
}

function QuestionRow({ annualId, q, n, lang, t, onChanged }: { annualId: string; q: AnnualQuestionView; n: number; lang: Lang; t: Dict; onChanged: () => void }) {
  const id = useId();
  const [note, setNote] = useState(q.note);
  const [busy, setBusy] = useState(false);
  const photos = usePhotoUpload(annualId, `q:${q.id}`, lang, t, onChanged);
  const problem = q.answer === q.problemAnswer;

  async function save(body: { answer?: QuestionAnswer; note?: string }) {
    setBusy(true);
    photos.setError(null);
    try {
      const res = await fetch(`/api/inspections/${annualId}/annual/answers/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) photos.setError(await errorText(res, lang, t.error));
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const options: { v: QuestionAnswer; label: string }[] = [
    { v: "yes", label: t.annYes },
    { v: "no", label: t.annNo },
    { v: "unknown", label: t.annUnknown },
  ];
  const tone = (v: QuestionAnswer) => (v === "unknown" ? "warn" : v === q.problemAnswer ? "bad" : "ok");

  return (
    <div className={`ann-q${problem ? " is-problem" : ""}`}>
      <div className="ann-q__top">
        <span className="ann-q__text" id={`${id}-q`}>
          <span className="ann-q__n">{n}.</span> {q.text}
        </span>
        <div className="ann-seg ann-seg--sm" role="group" aria-labelledby={`${id}-q`}>
          {options.map((o) => (
            <button
              key={o.v}
              type="button"
              className={`ann-seg__btn is-${tone(o.v)}`}
              aria-pressed={q.answer === o.v}
              disabled={busy || photos.uploading}
              onClick={() => save({ answer: o.v })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {problem && (
        <div className="ann-q__detail">
          <label className="form-label" htmlFor={`${id}-note`}>
            {t.annProblemLabel}
          </label>
          <textarea
            id={`${id}-note`}
            className="form-control form-control-sm"
            rows={2}
            placeholder={t.annProblemPh}
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== q.note && save({ note })}
          />
          <Thumbs ids={q.photoIds} label={t.photo} t={t} onRemove={busy || photos.uploading ? undefined : photos.remove} />
          <PhotoPicker id={id} t={t} busy={busy || photos.uploading} onFiles={photos.upload} />
        </div>
      )}
      {photos.error && (
        <div className="rp-callout rp-callout--danger mt-2" role="alert">
          <i className="bi bi-exclamation-circle" aria-hidden />
          <div>{photos.error}</div>
        </div>
      )}
    </div>
  );
}
