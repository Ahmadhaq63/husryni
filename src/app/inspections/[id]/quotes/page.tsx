import Link from "next/link";
import { notFound } from "next/navigation";
import QuotesClient, { type QuotableView, type QuoteView } from "@/components/QuotesClient";
import { getTemplate } from "@/lib/checklist";
import { getDict } from "@/lib/i18n";
import { negotiableFindings } from "@/lib/negotiation";
import { listQuotes, quotedFindingIds } from "@/lib/ownerRepo";
import { TRADE_LABEL, tradeFor } from "@/lib/ownerTools";
import { formatAddress } from "@/lib/postcodes";
import { getBundle } from "@/lib/repo";
import { finalReport } from "@/lib/server/ownerAccess";

/** Repair quote drafts for a final report: one per trade, reviewed and approved by the owner. */
export default async function QuotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = getBundle(id);
  if (!bundle || bundle.inspection.kind !== "full") notFound();
  const report = finalReport(id);
  const lang = bundle.inspection.lang;
  const t = getDict(lang);
  if (!report) {
    return (
      <div className="rp-page" lang={lang}>
        <div className="container rp-wrap rp-wrap--narrow">
          <div className="card rp-card rp-empty">
            <div className="card-body">
              <h1 className="rp-empty__title">{t.qtTitle}</h1>
              <p className="rp-empty__text">{t.histNotFinal}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  const title = (key: string) => getTemplate(key)?.title[lang] ?? key;
  const quoted = quotedFindingIds(id);
  const findings = negotiableFindings(bundle);
  const byId = new Map(findings.map((f) => [f.id, f]));
  const available: QuotableView[] = findings
    .filter((f) => !quoted.has(f.id))
    .map((f) => ({ id: f.id, title: f.title, itemTitle: title(f.itemKey), grade: f.grade, trade: TRADE_LABEL[tradeFor(f)][lang] }));
  const dateFmt = new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "long", timeZone: "Atlantic/Reykjavik" });
  const quotes: QuoteView[] = listQuotes(id).map((q) => ({
    id: q.id,
    number: q.number,
    trade: TRADE_LABEL[q.trade][lang],
    status: q.status,
    lines: q.lines,
    basedOn: q.findingIds.map((fid) => byId.get(fid)?.title ?? "—"),
    approvedText: q.approvedAt ? dateFmt.format(new Date(q.approvedAt)) : null,
  }));

  return (
    <div className="rp-page" lang={lang}>
      <div className="container rp-wrap">
        <nav className="rp-crumbs" aria-label={t.reportTitle}>
          <Link href={`/inspections/${id}/report`}>{t.reportTitle}</Link>
          <i className="bi bi-chevron-right" aria-hidden />
          <span aria-current="page">{t.qtTitle}</span>
        </nav>
        <header className="rp-head">
          <div className="rp-head__main">
            <div className="eyebrow">{t.qtTitle}</div>
            <h1 className="rp-title">{formatAddress(bundle.inspection.address, bundle.inspection.postalCode)}</h1>
            <p className="rp-lead">{t.qtLead}</p>
          </div>
        </header>
        <QuotesClient inspectionId={id} lang={lang} available={available} quotes={quotes} />
      </div>
    </div>
  );
}
