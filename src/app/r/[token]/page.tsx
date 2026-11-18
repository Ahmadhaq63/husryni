import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReportView from "@/components/ReportView";
import { getDict } from "@/lib/i18n";
import { getReadLink, recordReadLinkView } from "@/lib/ownerRepo";
import { getBundle } from "@/lib/repo";
import { finalReport } from "@/lib/server/ownerAccess";
import { requestOrigin } from "@/lib/server/origin";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * Read-only view of a report through a link the owner created (insurer, bank …). It never reveals the owner's
 * own inspection link, contact details or negotiation, and stops working when the owner revokes it.
 */
export default async function ReadOnlyReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = getReadLink(token);
  if (!link) notFound();
  const bundle = getBundle(link.inspectionId);
  if (!bundle || !finalReport(link.inspectionId)) notFound();
  const t = getDict(bundle.inspection.lang);
  if (link.revokedAt) {
    return (
      <div className="rp-page" lang={bundle.inspection.lang}>
        <div className="container rp-wrap rp-wrap--narrow">
          <div className="card rp-card rp-empty">
            <div className="card-body">
              <span className="rp-empty__icon" aria-hidden>
                <i className="bi bi-slash-circle" />
              </span>
              <h1 className="rp-empty__title">{t.roRevokedTitle}</h1>
              <p className="rp-empty__text">{t.roRevokedText}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  recordReadLinkView(token);
  return <ReportView bundle={bundle} origin={await requestOrigin()} mode="readonly" />;
}
