import { notFound, redirect } from "next/navigation";
import ReportView from "@/components/ReportView";
import { StatusChip } from "@/components/report/ui";
import { getDict } from "@/lib/i18n";
import { getBundle } from "@/lib/repo";
import { getLang, isInspector } from "@/lib/server/session";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = getBundle(id);
  if (!bundle) notFound();
  const { status } = bundle.inspection;

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

  return <ReportView bundle={bundle} />;
}
