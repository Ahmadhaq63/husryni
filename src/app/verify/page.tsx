import type { Metadata } from "next";
import GradeBadge from "@/components/GradeBadge";
import { getDict } from "@/lib/i18n";
import { formatAddress } from "@/lib/postcodes";
import { findBySealPrefix } from "@/lib/repo";
import { checkSeal } from "@/lib/seal";
import { normalizeFingerprint, shortFingerprint, standardLabel } from "@/lib/standard";
import { getLang } from "@/lib/server/session";

export const metadata: Metadata = { title: "Staðfesta skýrslu · Húsrýni", robots: { index: false } };

/**
 * Public check of a signed report: anyone holding a printed or PDF copy enters its fingerprint and sees
 * whether the stored report still matches it. Shows only what is on the report's seal, no contact details.
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const lang = await getLang();
  const t = getDict(lang);
  const raw = (await searchParams).code;
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const hex = code ? normalizeFingerprint(code) : null;
  const match = hex ? findBySealPrefix(hex) : null;
  const check = match ? await checkSeal(match.id) : null;
  const dateFmt = new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "long", timeStyle: "short" });

  return (
    <div className="rp-page">
      <div className="container rp-wrap rp-wrap--narrow">
        <header className="rp-head">
          <div className="rp-head__main">
            <div className="eyebrow">{t.brand}</div>
            <h1 className="rp-title">{t.stdVerifyTitle}</h1>
            <p className="rp-lead">{t.stdVerifyLead}</p>
          </div>
        </header>

        <form className="card rp-card std-verify__form" action="/verify" method="get">
          <div className="card-body">
            <label className="form-label" htmlFor="verify-code">
              {t.stdVerifyInput}
            </label>
            <div className="input-group">
              <input
                id="verify-code"
                name="code"
                className="form-control form-control-lg rp-mono"
                placeholder="3F2A-9C1B-77D0-4E21"
                defaultValue={code}
                autoComplete="off"
                spellCheck={false}
                required
              />
              <button type="submit" className="btn btn-primary">
                <i className="bi bi-shield-check me-2" aria-hidden />
                {t.stdVerifyBtn}
              </button>
            </div>
          </div>
        </form>

        {code && (
          <section className="mt-4" aria-live="polite">
            {!hex ? (
              <div className="rp-callout rp-callout--warning" role="alert">
                <i className="bi bi-exclamation-triangle" aria-hidden />
                <div>{t.stdVerifyInvalid}</div>
              </div>
            ) : !match || !check || check.status === "unsealed" ? (
              <div className="rp-callout rp-callout--danger" role="alert">
                <i className="bi bi-x-octagon" aria-hidden />
                <div>{t.stdVerifyNotFound}</div>
              </div>
            ) : (
              <div className={`card rp-card std-verify std-verify--${check.status}`}>
                <div className="card-body">
                  <div className="std-verify__verdict">
                    <i className={`bi ${check.status === "intact" ? "bi-patch-check-fill" : "bi-exclamation-octagon-fill"}`} aria-hidden />
                    <strong>{check.status === "intact" ? t.stdVerifyIntact : t.stdVerifyChanged}</strong>
                  </div>
                  <dl className="rp-facts std-verify__facts">
                    <div className="rp-fact rp-fact--wide">
                      <dt>{t.fAddress}</dt>
                      <dd>{formatAddress(match.address, match.postalCode)}</dd>
                    </div>
                    <div className="rp-fact">
                      <dt>{t.stdVerifySignedBy}</dt>
                      <dd>
                        {match.inspectorName}
                        <div className="rp-table__sub">
                          {t.license} {match.inspectorLicense}
                        </div>
                      </dd>
                    </div>
                    <div className="rp-fact">
                      <dt>{t.signedAt}</dt>
                      <dd>{match.signedAt ? dateFmt.format(new Date(match.signedAt)) : "—"}</dd>
                    </div>
                    <div className="rp-fact">
                      <dt>{t.stdOverall}</dt>
                      <dd>{match.overallGrade ? <GradeBadge grade={match.overallGrade} lang={lang} /> : "—"}</dd>
                    </div>
                    <div className="rp-fact">
                      <dt>{standardLabel(lang, "").trim()}</dt>
                      <dd>{match.standardVersion}</dd>
                    </div>
                    <div className="rp-fact rp-fact--wide">
                      <dt>{t.stdSealLabel}</dt>
                      <dd className="rp-mono">{shortFingerprint(match.reportHash ?? "")}</dd>
                    </div>
                    <div className="rp-fact rp-fact--wide">
                      <dt>{t.stdVerifyChecked}</dt>
                      <dd>{dateFmt.format(new Date())}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
