"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FixBadge } from "./NegotiationClient";
import { Chip } from "./report/ui";
import { resizeForUpload } from "@/lib/client/image";
import { getDict } from "@/lib/i18n";
import { DISPUTE_REASONS, type DisputeReason, type Lang, type Remedy } from "@/lib/types";

async function errorText(res: Response, lang: Lang, fallback: string) {
  try {
    const body = await res.json();
    return (body?.error?.[lang] as string | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Per-item seller controls: accept / dispute, and for repairs: after photos + AI before/after check. */
export default function SellerItemControls({
  token,
  findingId,
  lang,
  remedy,
  afterPhotoIds,
}: {
  token: string;
  findingId: string;
  lang: Lang;
  remedy: Remedy;
  afterPhotoIds: string[];
}) {
  const t = getDict(lang);
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());
  const [mode, setMode] = useState<"view" | "dispute">("view");
  const [reason, setReason] = useState<DisputeReason>(remedy.disputeReason ?? "normal_wear");
  const [comment, setComment] = useState(remedy.sellerComment);
  const [busy, setBusy] = useState<null | "respond" | "upload" | "verify">(null);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);

  async function respond(sellerResponse: "accepted" | "disputed") {
    setBusy("respond");
    setError(null);
    try {
      const res = await fetch(`/api/share/${token}/remedies/${findingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerResponse, disputeReason: sellerResponse === "disputed" ? reason : null, sellerComment: comment }),
      });
      if (!res.ok) setError(await errorText(res, lang, t.error));
      else setMode("view");
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function upload(files: FileList | null, source: "camera" | "upload") {
    if (!files?.length) return;
    setBusy("upload");
    setError(null);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", await resizeForUpload(f), "after.jpg");
        fd.append("source", source);
        const res = await fetch(`/api/share/${token}/remedies/${findingId}/photos`, { method: "POST", body: fd });
        if (!res.ok) {
          setError(await errorText(res, lang, t.error));
          break;
        }
      }
    } finally {
      setBusy(null);
      if (camera.current) camera.current.value = "";
      if (library.current) library.current.value = "";
      refresh();
    }
  }

  async function removePhoto(photoId: string) {
    setError(null);
    const res = await fetch(`/api/share/${token}/photos/${photoId}`, { method: "DELETE" });
    if (!res.ok) setError(await errorText(res, lang, t.error));
    refresh();
  }

  async function verify() {
    setBusy("verify");
    setError(null);
    try {
      const res = await fetch(`/api/share/${token}/remedies/${findingId}/verify`, { method: "POST" });
      if (!res.ok) setError(await errorText(res, lang, t.error));
    } finally {
      setBusy(null);
      refresh();
    }
  }

  const accepted = remedy.sellerResponse === "accepted";

  return (
    <div className="rp-seller">
      {mode === "view" ? (
        <div className="rp-seller__respond">
          <div className="rp-seller__status">
            <span className="rp-response__label">{t.sellerResponse}</span>
            {remedy.sellerResponse === "none" ? (
              <Chip tone="outline" icon="bi-hourglass">
                {t.respNone}
              </Chip>
            ) : (
              <Chip tone={accepted ? "success" : "danger"} icon={accepted ? "bi-check2-circle" : "bi-x-circle"}>
                {accepted ? t.respAccepted : t.respDisputed}
                {remedy.disputeReason && ` — ${t[`reason_${remedy.disputeReason}`]}`}
              </Chip>
            )}
          </div>
          <div className="rp-seller__buttons">
            <button type="button" className="btn btn-success" disabled={!!busy} onClick={() => respond("accepted")}>
              <i className="bi bi-check2 me-1" aria-hidden />
              {t.accept}
            </button>
            <button type="button" className="btn btn-outline-danger" disabled={!!busy} onClick={() => setMode("dispute")}>
              <i className="bi bi-x-lg me-1" aria-hidden />
              {t.dispute}
            </button>
          </div>
        </div>
      ) : (
        <div className="rp-seller__dispute">
          <label className="form-label" htmlFor={`reason-${findingId}`}>
            {t.disputeReason}
          </label>
          <select id={`reason-${findingId}`} className="form-select mb-3" value={reason} onChange={(e) => setReason(e.target.value as DisputeReason)}>
            {DISPUTE_REASONS.map((r) => (
              <option key={r} value={r}>
                {t[`reason_${r}`]}
              </option>
            ))}
          </select>
          <label className="form-label" htmlFor={`comment-${findingId}`}>
            {t.sellerComment}
          </label>
          <textarea id={`comment-${findingId}`} className="form-control mb-3" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="rp-seller__buttons">
            <button type="button" className="btn btn-danger" disabled={!!busy} onClick={() => respond("disputed")}>
              <i className="bi bi-send me-1" aria-hidden />
              {t.sendResponse}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setMode("view")}>
              {t.rpCancel}
            </button>
          </div>
        </div>
      )}

      {remedy.action === "seller_fix" && (
        <div className="rp-seller__fix">
          <div className="rp-label">{t.after}</div>
          <div className="rp-uploads">
            {afterPhotoIds.map((pid, i) => (
              <div className="rp-photo" key={pid}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/photos/${pid}`} alt={`${t.after} ${i + 1}`} loading="lazy" />
                <span className="rp-photo__num" aria-hidden>
                  {i + 1}
                </span>
                <button type="button" className="rp-photo__del" aria-label={t.deletePhoto} title={t.deletePhoto} disabled={!!busy} onClick={() => removePhoto(pid)}>
                  <i className="bi bi-x-lg" aria-hidden />
                </button>
              </div>
            ))}
            <label className={`rp-uptile rp-uptile--primary${busy ? " is-disabled" : ""}`}>
              <i className="bi bi-camera" aria-hidden />
              <span>{busy === "upload" ? t.uploading : t.takePhoto}</span>
              <input ref={camera} type="file" accept="image/*" capture="environment" className="visually-hidden" disabled={!!busy} onChange={(e) => upload(e.target.files, "camera")} />
            </label>
            <label className={`rp-uptile${busy ? " is-disabled" : ""}`}>
              <i className="bi bi-images" aria-hidden />
              <span>{t.fromLibrary}</span>
              <input ref={library} type="file" accept="image/*" multiple className="visually-hidden" disabled={!!busy} onChange={(e) => upload(e.target.files, "upload")} />
            </label>
          </div>
          <button type="button" className="btn btn-primary mt-3" disabled={!!busy || afterPhotoIds.length === 0} onClick={verify}>
            {busy === "verify" ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" aria-hidden />
                {t.verifying}
              </>
            ) : (
              <>
                <i className="bi bi-stars me-2" aria-hidden />
                {t.verifyFix}
              </>
            )}
          </button>
          {remedy.fixStatus !== "none" && (
            <div className="rp-verdict">
              <FixBadge status={remedy.fixStatus} t={t} />
              {remedy.fixVerdict && (
                <>
                  <p className="rp-verdict__text">{remedy.fixVerdict.explanation}</p>
                  {remedy.fixVerdict.remainingIssues.length > 0 && (
                    <ul className="rp-verdict__list">
                      {remedy.fixVerdict.remainingIssues.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  )}
                  {remedy.fixVerdict.retakeRequests.length > 0 && (
                    <div className="rp-callout rp-callout--warning mt-2">
                      <i className="bi bi-camera" aria-hidden />
                      <div>
                        {remedy.fixVerdict.retakeRequests.map((r, i) => (
                          <div key={i} className={i ? "mt-1" : undefined}>
                            {r.photoNumber ? `${t.after} ${r.photoNumber}: ` : ""}
                            {r.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <p className="rp-seller__disclaimer">{t.fixDisclaimer}</p>
        </div>
      )}
      {error && (
        <div className="rp-callout rp-callout--danger mt-3" role="alert">
          <i className="bi bi-exclamation-circle" aria-hidden />
          <div>{error}</div>
        </div>
      )}
    </div>
  );
}
