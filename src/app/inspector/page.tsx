import Link from "next/link";
import { InspectorLogin, LogoutButton } from "@/components/InspectorAuth";
import { StatusChip } from "@/components/report/ui";
import { getDict } from "@/lib/i18n";
import { PROPERTY_TYPE_LABEL, STATUS_LABEL, TIER_LABEL } from "@/lib/labels";
import { getBundle, listInspections } from "@/lib/repo";
import { activeFindings } from "@/lib/report";
import { AGREEMENT_TARGET_PCT, agreementPairs, agreementStats, type AgreementPair, type AgreementStats } from "@/lib/standard";
import { getLang, isInspector } from "@/lib/server/session";
import type { InspectionStatus } from "@/lib/types";
import { postcodeWithTown } from "@/lib/postcodes";

const ORDER: Record<InspectionStatus, number> = { in_review: 0, capturing: 1, ai_report: 2, verified: 3 };
const STAT_ICON: Record<InspectionStatus, string> = {
  in_review: "bi-hourglass-split",
  capturing: "bi-camera",
  ai_report: "bi-robot",
  verified: "bi-patch-check",
};

export default async function InspectorHome() {
  const lang = await getLang();
  const t = getDict(lang);
  if (!(await isInspector())) {
    return (
      <div className="rp-page rp-page--center">
        <div className="container">
          <InspectorLogin lang={lang} />
        </div>
      </div>
    );
  }

  const inspections = listInspections().sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const dateFmt = new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const statuses = (Object.keys(ORDER) as InspectionStatus[]).sort((a, b) => ORDER[a] - ORDER[b]);
  const countBy = (s: InspectionStatus) => inspections.filter((i) => i.status === s).length;

  // AI–inspector agreement over signed reports: the AI's original grade vs the inspector's final one, per item.
  const bundles = new Map(inspections.map((i) => [i.id, getBundle(i.id)]));
  const perReport = new Map<string, AgreementStats>();
  const allPairs: AgreementPair[] = [];
  for (const i of inspections.filter((x) => x.status === "verified")) {
    const b = bundles.get(i.id);
    if (!b) continue;
    const pairs = agreementPairs(
      b.items.map((it) => ({ itemKey: it.itemKey, analyzed: it.status === "analyzed", skipped: it.status === "skipped" })),
      b.findings,
    );
    if (pairs.length) perReport.set(i.id, agreementStats(pairs));
    allPairs.push(...pairs);
  }
  const agreement = agreementStats(allPairs);
  const numLocale = lang === "is" ? "is-IS" : "en-GB";

  return (
    <div className="rp-page">
      <div className="container rp-wrap rp-wrap--wide">
        <header className="rp-head">
          <div className="rp-head__main">
            <div className="eyebrow">{t.inspectorTitle}</div>
            <h1 className="rp-title">{t.queue}</h1>
            <p className="rp-lead">{t.rpQueueLead}</p>
          </div>
          <div className="rp-head__actions">
            <LogoutButton lang={lang} />
          </div>
        </header>

        <ul className="rp-stats" aria-label={t.status}>
          {statuses.map((s) => (
            <li key={s} className={`rp-stat-tile${s === "in_review" ? " is-focus" : ""}`}>
              <span className="rp-stat-tile__icon" aria-hidden>
                <i className={`bi ${STAT_ICON[s]}`} />
              </span>
              <span className="rp-stat-tile__value">{countBy(s)}</span>
              <span className="rp-stat-tile__label">{STATUS_LABEL[s][lang]}</span>
            </li>
          ))}
        </ul>

        <section className="card rp-card agr-card mb-4" aria-labelledby="agr-title">
          <div className="card-body">
            <div className="agr-card__main">
              <div>
                <h2 id="agr-title" className="rp-label">
                  {t.agrTitle}
                </h2>
                <p className="agr-card__lead">{t.agrLead.replace("{target}", String(AGREEMENT_TARGET_PCT))}</p>
              </div>
              {agreement.withinOnePct != null ? (
                <div className={`agr-card__value${agreement.withinOnePct >= AGREEMENT_TARGET_PCT ? " is-ok" : " is-low"}`}>
                  {agreement.withinOnePct.toLocaleString(numLocale)} %
                </div>
              ) : (
                <div className="agr-card__none">{t.agrNone}</div>
              )}
            </div>
            {agreement.withinOnePct != null && (
              <div className="agr-card__sub">
                <span>{t.agrExact.replace("{p}", (agreement.exactPct ?? 0).toLocaleString(numLocale))}</span>
                <span>{t.agrBasis.replace("{n}", String(agreement.items)).replace("{m}", String(perReport.size))}</span>
              </div>
            )}
          </div>
        </section>
        {inspections.length === 0 ? (
          <div className="card rp-card rp-empty">
            <div className="card-body">
              <span className="rp-empty__icon" aria-hidden>
                <i className="bi bi-inbox" />
              </span>
              <p className="rp-empty__text mt-0">{t.noInspections}</p>
            </div>
          </div>
        ) : (
          <div className="card rp-queue">
            <table className="rp-qtable">
              <thead>
                <tr>
                  <th scope="col">{t.fAddress}</th>
                  <th scope="col">{t.fPropertyType}</th>
                  <th scope="col">{t.status}</th>
                  <th scope="col" className="num">
                    <span className="rp-swatch" style={{ background: "var(--grade-2)" }} aria-hidden /> TG2
                  </th>
                  <th scope="col" className="num">
                    <span className="rp-swatch" style={{ background: "var(--grade-3)" }} aria-hidden /> TG3
                  </th>
                  <th scope="col" className="num">
                    {t.agrCol}
                  </th>
                  <th scope="col">{t.created}</th>
                  <th scope="col">
                    <span className="visually-hidden">{t.open}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((i) => {
                  const findings = activeFindings(bundles.get(i.id)?.findings ?? []);
                  const agr = perReport.get(i.id);
                  const tg2 = findings.filter((f) => f.grade === "TG2").length;
                  const tg3 = findings.filter((f) => f.grade === "TG3").length;
                  return (
                    <tr key={i.id} className={i.status === "in_review" ? "is-focus" : undefined}>
                      <td data-label={t.fAddress}>
                        <div className="rp-qtable__addr">{i.address}</div>
                        <div className="rp-qtable__sub">
                          {postcodeWithTown(i.postalCode)} · {TIER_LABEL[i.tier][lang]}
                        </div>
                      </td>
                      <td data-label={t.fPropertyType}>
                        {PROPERTY_TYPE_LABEL[i.propertyType][lang]}
                        <div className="rp-qtable__sub">{i.buildYear}</div>
                      </td>
                      <td data-label={t.status}>
                        <StatusChip status={i.status} lang={lang} />
                      </td>
                      <td data-label="TG2" className={`num${tg2 ? " is-hot" : ""}`}>
                        {tg2}
                      </td>
                      <td data-label="TG3" className={`num${tg3 ? " is-hot" : ""}`}>
                        {tg3}
                      </td>
                      <td data-label={t.agrCol} className="num">
                        {agr?.withinOnePct != null ? `${agr.withinOnePct.toLocaleString(numLocale)} %` : "—"}
                      </td>
                      <td data-label={t.created} className="rp-qtable__date">
                        {dateFmt.format(new Date(i.createdAt))}
                      </td>
                      <td className="rp-qtable__action">
                        {i.status === "in_review" ? (
                          <Link className="btn btn-sm btn-primary" href={`/inspector/${i.id}`}>
                            {t.open}
                            <i className="bi bi-arrow-right ms-1" aria-hidden />
                          </Link>
                        ) : i.status === "capturing" ? null : (
                          <Link className="btn btn-sm btn-outline-primary" href={`/inspections/${i.id}/report`}>
                            {t.viewReport}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
