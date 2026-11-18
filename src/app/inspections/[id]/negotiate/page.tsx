import Link from "next/link";
import { notFound } from "next/navigation";
import NegotiationClient, { type NegItem } from "@/components/NegotiationClient";
import { getTemplate } from "@/lib/checklist";
import { formatIsk, getCost } from "@/lib/costs";
import { getDict } from "@/lib/i18n";
import {
  computeTotals,
  offerGuide,
  estimateIsk,
  hasOwnersAssociation,
  likelyCommonProperty,
  negotiableFindings,
  negotiationOpen,
} from "@/lib/negotiation";
import { ensureNegotiation, fixItemKey, listRemedies } from "@/lib/negotiationRepo";
import { getBundle } from "@/lib/repo";
import { getLang } from "@/lib/server/session";
import { formatAddress } from "@/lib/postcodes";

export default async function NegotiatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = getBundle(id);
  if (!bundle) notFound();
  const lang = await getLang();
  const t = getDict(lang);
  const { inspection } = bundle;

  if (!negotiationOpen(inspection.status, inspection.kind)) {
    return (
      <div className="rp-page">
        <div className="container rp-wrap rp-wrap--narrow">
          <div className="card rp-card rp-empty">
            <div className="card-body">
              <span className="rp-empty__icon" aria-hidden>
                <i className="bi bi-arrow-left-right" />
              </span>
              <h1 className="rp-empty__title">{t.negTitle}</h1>
              <p className="rp-empty__text">{t.negUnavailable}</p>
              <Link href={`/inspections/${id}`} className="btn btn-outline-primary mt-4">
                <i className="bi bi-arrow-left me-2" aria-hidden />
                {t.back}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const negotiation = ensureNegotiation(id);
  const remedies = listRemedies(id);
  const findings = negotiableFindings(bundle);
  const items: NegItem[] = findings.map((f) => {
    const c = getCost(f.costKey);
    const itemPhotos = bundle.photos.filter((p) => p.itemKey === f.itemKey).map((p) => p.id);
    return {
      id: f.id,
      itemTitle: getTemplate(f.itemKey)?.title[lang] ?? f.itemKey,
      title: f.title,
      description: f.description,
      grade: f.grade,
      estimate: estimateIsk(f),
      costRange: c ? `${formatIsk(c.minIsk, lang)} – ${formatIsk(c.maxIsk, lang)}` : null,
      likelyCommon: likelyCommonProperty(f.itemKey, inspection.propertyType),
      photoIds: f.photoIds.length ? f.photoIds : itemPhotos,
      afterPhotoIds: bundle.photos.filter((p) => p.itemKey === fixItemKey(f.id)).map((p) => p.id),
      remedy: remedies.get(f.id) ?? null,
    };
  });

  const totals = computeTotals(findings, remedies, negotiation.ownerSharePct);
  return (
    <div className="rp-page">
      <div className="container rp-wrap rp-wrap--wide">
        <nav className="rp-crumbs" aria-label={t.reportTitle}>
          <Link href={`/inspections/${id}/report`}>{t.reportTitle}</Link>
          <i className="bi bi-chevron-right" aria-hidden />
          <span aria-current="page">{t.negTitle}</span>
        </nav>
        <header className="rp-head">
          <div className="rp-head__main">
            <div className="eyebrow">{t.negTitle}</div>
            <h1 className="rp-title">
              {formatAddress(inspection.address, inspection.postalCode)}
            </h1>
            <p className="rp-lead">{t.negLead}</p>
          </div>
        </header>
        {items.length === 0 ? (
          <div className="rp-callout rp-callout--success">
            <i className="bi bi-check2-circle" aria-hidden />
            <div>{t.noNegotiable}</div>
          </div>
        ) : (
          <NegotiationClient
            inspectionId={id}
            lang={lang}
            items={items}
            hasAssociation={hasOwnersAssociation(inspection.propertyType)}
            shareToken={negotiation.shareToken}
            settings={{ ownerSharePct: negotiation.ownerSharePct, responseDeadline: negotiation.responseDeadline, note: negotiation.note }}
            totals={totals}
            priceIsk={inspection.priceIsk}
            offer={inspection.purpose === "buyer" && inspection.priceIsk ? offerGuide(inspection.priceIsk, findings, remedies, totals, negotiation.ownerSharePct) : null}
          />
        )}
      </div>
    </div>
  );
}
