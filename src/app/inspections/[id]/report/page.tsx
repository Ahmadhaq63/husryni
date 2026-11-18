import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AskPanel from "@/components/AskPanel";
import ReadLinksPanel, { type ReadLinkView } from "@/components/ReadLinksPanel";
import ReportView from "@/components/ReportView";
import { StatusChip } from "@/components/report/ui";
import { getDict } from "@/lib/i18n";
import { aiEngine } from "@/lib/ai";
import { historyOpen } from "@/lib/annualRepo";
import { listQuotes, listReadLinks } from "@/lib/ownerRepo";
import { getBundle } from "@/lib/repo";
import { requestOrigin } from "@/lib/server/origin";
import { getLang, isInspector } from "@/lib/server/session";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = getBundle(id);
  if (!bundle) notFound();
  const { status } = bundle.inspection;

  if (bundle.inspection.kind === "annual") redirect(`/inspections/${id}/annual`);
  if (status === "capturing") redirect(`/inspections/${id}`);

  // A verified-tier report is only published to the client once an inspector has signed it.
  if (status === "in_review" && !(await isInspector())) {
    const lang = await getLang();
    const t = getDict(lang);
    return (
      <div className="rp-page">
        <div className="container rp-wrap rp-wrap--narrow">
          <div className="card rp-card rp-empty">
            <div className="card-body">
              <span className="rp-empty__icon" aria-hidden>
                <i className="bi bi-hourglass-split" />
              </span>
              <div className="eyebrow">{t.reportTitle}</div>
              <h1 className="rp-empty__title">{bundle.inspection.address}</h1>
              <StatusChip status={status} lang={lang} />
              <p className="rp-empty__text">{t.submittedVerified}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const origin = await requestOrigin();
  const final = historyOpen(bundle.inspection);
  if (!final) return <ReportView bundle={bundle} origin={origin} />;

  const lang = bundle.inspection.lang;
  const t = getDict(lang);
  const dateFmt = new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Atlantic/Reykjavik" });
  const links: ReadLinkView[] = listReadLinks(id).map((l) => ({
    token: l.token,
    audience: l.audience,
    label: l.label,
    createdText: dateFmt.format(new Date(l.createdAt)),
    views: l.views,
    lastViewedText: l.lastViewedAt ? dateFmt.format(new Date(l.lastViewedAt)) : null,
    revoked: !!l.revokedAt,
  }));
  const quotes = listQuotes(id);
  return (
    <>
      <ReportView
        bundle={bundle}
        origin={origin}
        ownerTools={
          <section className="card rp-card no-print" aria-labelledby="own-tools">
            <div className="card-body">
              <h2 id="own-tools" className="rp-label">
                {t.ownTitle}
              </h2>
              <div className="own-tools">
                <ReadLinksPanel inspectionId={id} lang={lang} links={links} origin={origin} />
                <div className="own-tools__quotes">
                  <h3 className="rl__title">
                    <i className="bi bi-receipt" aria-hidden />
                    {t.qtTitle}
                  </h3>
                  <p className="rl__lead">{t.ownQuotesLead}</p>
                  {quotes.length > 0 && (
                    <p className="rl__lead">
                      {quotes.map((q) => `${q.number} (${q.status === "approved" ? t.qtApproved : q.status === "sent" ? t.qtSent : t.qtDraft})`).join(" · ")}
                    </p>
                  )}
                  <Link className="btn btn-sm btn-outline-primary" href={`/inspections/${id}/quotes`}>
                    {t.qtTitle}
                    <i className="bi bi-arrow-right ms-1" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        }
      />
      <AskPanel inspectionId={id} lang={lang} demo={aiEngine() !== "claude"} />
    </>
  );
}
