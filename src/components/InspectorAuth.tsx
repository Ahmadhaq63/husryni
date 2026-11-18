"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getDict } from "@/lib/i18n";
import type { Lang } from "@/lib/types";

export function InspectorLogin({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inspector/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        setError(t.badPasscode);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card rp-auth" aria-labelledby="rp-login-title">
      <div className="card-body">
        <span className="rp-auth__icon" aria-hidden>
          <i className="bi bi-shield-lock" />
        </span>
        <div className="eyebrow">{t.inspectorTitle}</div>
        <h1 id="rp-login-title" className="rp-auth__title">
          {t.loginTitle}
        </h1>
        <p className="rp-auth__lead">{t.rpLoginLead}</p>
        <label className="form-label" htmlFor="passcode">
          {t.passcode}
        </label>
        <input
          id="passcode"
          type="password"
          className="form-control form-control-lg mb-3"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoComplete="current-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "rp-login-error" : undefined}
        />
        {error && (
          <div id="rp-login-error" className="rp-callout rp-callout--danger mb-3" role="alert">
            <i className="bi bi-exclamation-circle" aria-hidden />
            <div>{error}</div>
          </div>
        )}
        <button className="btn btn-primary btn-lg w-100" disabled={busy || !passcode}>
          {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden />}
          {t.login}
        </button>
      </div>
    </form>
  );
}

export function LogoutButton({ lang }: { lang: Lang }) {
  const t = getDict(lang);
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-outline-secondary"
      onClick={async () => {
        await fetch("/api/inspector/logout", { method: "POST" });
        router.refresh();
      }}
    >
      <i className="bi bi-box-arrow-right me-2" aria-hidden />
      {t.logout}
    </button>
  );
}
