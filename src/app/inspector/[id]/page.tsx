import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReviewClient, { type ReviewItem } from "@/components/ReviewClient";
import { GRADE_ORDER, StatusChip } from "@/components/report/ui";
import { getTemplate } from "@/lib/checklist";
import { GRADE_COLOR } from "@/lib/gradeColors";
import { getDict } from "@/lib/i18n";
import { CONSTRUCTION_LABEL, GRADE_INFO, HEATING_LABEL, PROPERTY_TYPE_LABEL, PURPOSE_LABEL, STATUS_LABEL } from "@/lib/labels";
import { formatIsk } from "@/lib/costs";
import { feeForTier } from "@/lib/pricing";
import { getBundle, relatedReports } from "@/lib/repo";
import { buildReport } from "@/lib/report";
import { overallReasonText } from "@/lib/standard";
import { getLang, isInspector } from "@/lib/server/session";
import { formatAddress } from "@/lib/postcodes";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isInspector())) redirect("/inspector");
  const { id } = await params;
  const bundle = getBundle(id);
  if (!bundle) notFound();
  const lang = await getLang();
  const t = getDict(lang);
  const { inspection } = bundle;

  if (inspection.status !== "in_review") {
    return (
      <div className="rp-page">
        <div className="container rp-wrap rp-wrap--narrow">
          <nav className="rp-crumbs" aria-label={t.queue}>
            <Link href="/inspector">{t.queue}</Link>
            <i className="bi bi-chevron-right" aria-hidden />
            <span aria-current="page">{t.reviewTitle}</span>
          </nav>
          <div className="card rp-card rp-empty">
            <div className="card-body">
              <span className="rp-empty__icon" aria-hidden>
                <i className="bi bi-lock" />
              </span>
              <div className="eyebrow">{t.reviewTitle}</div>
              <h1 className="rp-empty__title">
                {formatAddress(inspection.address, inspection.postalCode)}
              </h1>
              <StatusChip status={inspection.status} lang={lang} />
              <p className="rp-empty__text">{t.lockedVerified}</p>
              <Link href={`/inspections/${id}/report`} className="btn btn-primary mt-4">
                {t.viewReport}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const report = buildReport(bundle);
  const related = relatedReports(inspection);
  const items: ReviewItem[] = bundle.items.flatMap((item) => {
    const tpl = getTemplate(item.itemKey);
    if (!tpl) return [];
    const itemPhotos = bundle.photos.filter((p) => p.itemKey === item.itemKey);
    const photoIds = itemPhotos.map((p) => p.id);
    const findings = bundle.findings.filter((f) => f.itemKey === item.itemKey);
    if (tpl.minPhotos === 0 && photoIds.length === 0 && findings.length === 0) return [];
    return [
      {
        key: item.itemKey,
        title: tpl.title[lang],
        notes: item.notes,
        skipped: item.status === "skipped",
        naReason: item.naReason,
        itemSummary: item.analysis?.itemSummary ?? null,
        photoIds,
        libraryPhotoIds: itemPhotos.filter((p) => p.source === "upload").map((p) => p.id),
        findings,
      },
    ];
  });

  return (
    <div className="rp-page">
      <div className="container rp-wrap rp-wrap--wide">
        <nav className="rp-crumbs" aria-label={t.queue}>
          <Link href="/inspector">{t.queue}</Link>
          <i className="bi bi-chevron-right" aria-hidden />
          <span aria-current="page">{t.reviewTitle}</span>
        </nav>
        <header className="rp-head">
          <div className="rp-head__main">
            <div className="eyebrow">{t.reviewTitle}</div>
            <h1 className="rp-title">
              {formatAddress(inspection.address, inspection.postalCode)}
            </h1>
            <div className="rp-head__meta">
              <span>
                <i className="bi bi-house" aria-hidden />
                {PROPERTY_TYPE_LABEL[inspection.propertyType][lang]}
              </span>
              <span>
                <i className="bi bi-calendar3" aria-hidden />
                {inspection.buildYear}
              </span>
              <span>
                <i className="bi bi-rulers" aria-hidden />
                {inspection.sizeM2} m²
              </span>
              <span>
                <i className="bi bi-bricks" aria-hidden />
                {CONSTRUCTION_LABEL[inspection.construction][lang]}
              </span>
              <span>
                <i className="bi bi-thermometer-half" aria-hidden />
                {HEATING_LABEL[inspection.heating][lang]}
              </span>
              <span>
                <i className="bi bi-person" aria-hidden />
                {PURPOSE_LABEL[inspection.purpose][lang]}
              </span>
            </div>
            <ul className="rp-gcounts" aria-label={t.gradeOverview}>
              {GRADE_ORDER.map((g) => (
                <li key={g} className={report.counts[g] ? undefined : "is-zero"} title={GRADE_INFO[g].label[lang]}>
                  <span className="rp-swatch" style={{ background: GRADE_COLOR[g].solid }} aria-hidden />
                  <span className="rp-gcounts__g">{g}</span>
                  <strong>{report.counts[g]}</strong>
                  <span className="visually-hidden"> · {GRADE_INFO[g].label[lang]}</span>
                </li>
              ))}
            </ul>
          </div>
          {related.length > 0 && (
            <aside className="rel-reports" aria-labelledby="rel-title">
              <h2 id="rel-title" className="rp-label">
                {t.relTitle}
              </h2>
              <ul>
                {related.map(({ inspection: r, match }) => (
                  <li key={r.id}>
                    <Link href={r.status === "in_review" ? `/inspector/${r.id}` : `/inspections/${r.id}/report`} target="_blank">
                      {new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "medium" }).format(new Date(r.createdAt))}
                    </Link>{" "}
                    · {STATUS_LABEL[r.status][lang]}
                    {r.overallGrade && ` · ${r.overallGrade}`} · <span className="rel-reports__match">{match === "fastanumer" ? t.relSameFnr : t.relSameAddr}</span>
                  </li>
                ))}
              </ul>
            </aside>
          )}
          <div className="rp-head__actions">
            <Link href={`/inspections/${id}/report`} className="btn btn-outline-primary" target="_blank">
              {t.viewReport}
              <i className="bi bi-box-arrow-up-right ms-2" aria-hidden />
            </Link>
          </div>
        </header>
        <ReviewClient
          inspectionId={id}
          lang={lang}
          items={items}
          defaultStatement={getDict(inspection.lang).signDefaultStatement}
          moisture={bundle.moisture}
          feeText={(() => {
            const fee = feeForTier(inspection.tier);
            return fee != null ? formatIsk(fee, lang) : t.stdFeeQuoted;
          })()}
          overall={{
            grade: report.overall.grade,
            reason: overallReasonText(report.overall, lang, (k) => getTemplate(k)?.title[lang] ?? k),
            notAssessed: report.overall.notAssessed.length,
          }}
        />
      </div>
    </div>
  );
}
