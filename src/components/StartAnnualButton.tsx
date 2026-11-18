"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Starts (or resumes) the yearly owner check for a report and opens it. */
export default function StartAnnualButton({
  reportId,
  label,
  lang,
  className = "btn btn-primary",
}: {
  reportId: string;
  label: string;
  lang: "is" | "en";
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/inspections/${reportId}/annual`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.id) {
        setError(body?.error?.[lang] ?? (lang === "is" ? "Villa kom upp." : "Something went wrong."));
        return;
      }
      router.push(`/inspections/${body.id}/annual`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={start}>
        {busy ? <span className="spinner-border spinner-border-sm me-2" aria-hidden /> : <i className="bi bi-clipboard2-check me-2" aria-hidden />}
        {label}
      </button>
      {error && (
        <span className="text-danger small ms-2" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
