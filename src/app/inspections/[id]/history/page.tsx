import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import GradeBadge from "@/components/GradeBadge";
import AskPanel from "@/components/AskPanel";
import ProblemsPanel, { type ProblemView } from "@/components/ProblemsPanel";
import StartAnnualButton from "@/components/StartAnnualButton";
import { Chip } from "@/components/report/ui";
import { aiEngine } from "@/lib/ai";
import { annualTotals, FOLLOWUP_VERDICT_LABEL, isOverdue } from "@/lib/annual";
import { dueDate, getAnswers, getFollowUps, historyOpen, listAnnualChecks, openFindings } from "@/lib/annualRepo";
import { getTemplate } from "@/lib/checklist";
import { getDict } from "@/lib/i18n";
import { TIER_LABEL, URGENCY_LABEL } from "@/lib/labels";
import { listProblems } from "@/lib/ownerRepo";
import { PROBLEM_CATEGORY_LABEL, RESPONSE_TIME_LABEL, TRADE_LABEL } from "@/lib/ownerTools";
import { formatAddress } from "@/lib/postcodes";
import { getBundle } from "@/lib/repo";
import { buildReport } from "@/lib/report";
import { shortFingerprint } from "@/lib/standard";
import type { FollowUpRecord } from "@/lib/types";

/** The property's history: the report, every yearly check, what is still open and when the next check is due. */
export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = getBundle(id);
  if (!bundle) notFound();
  const report = bundle.inspection;
  if (report.kind === "annual" && report.parentId) redirect(`/inspections/${report.parentId}/history`);
  const lang = report.lang;
  const t = getDict(lang);
  const dateFmt = new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "long" });
  const title = (key: string) => getTemplate(key)?.title[lang] ?? key;

  if (!historyOpen(report)) {
    return (
      <div className="rp-page" lang={lang}>
        <div className="container rp-wrap rp-wrap--narrow">
          <div className="card rp-card rp-empty">
            <div className="card-body">
              <span className="rp-empty__icon" aria-hidden>
                <i className="bi bi-clock-history" />
              </span>
              <h1 className="rp-empty__title">{t.histTitle}</h1>
              <p className="rp-empty__text">{t.histNotFinal}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const checks = listAnnualChecks(id);
  const inProgress = checks.find((c) => c.status === "capturing");
  const due = dueDate(report);
  const overdue = isOverdue(due);
  const open = openFindings(id);
  const overall = report.overallGrade ?? buildReport(bundle).overall.grade;
  const stamp = new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Atlantic/Reykjavik" });
  const problems: ProblemView[] = listProblems(id).map((p) => ({
    id: p.id,
    text: p.text,
    createdText: stamp.format(new Date(p.createdAt)),
    status: p.status,
    category: p.triage ? PROBLEM_CATEGORY_LABEL[p.triage.category][lang] : "—",
    trade: p.triage ? TRADE_LABEL[p.triage.trade][lang] : "—",
    urgency: p.triage ? URGENCY_LABEL[p.triage.urgency][lang] : "",
    within: p.triage ? RESPONSE_TIME_LABEL[p.triage.respondWithin][lang] : "—",
    advice: p.triage?.advice ?? "",
    urgent: p.triage?.urgency === "immediate",
  }));
  // The latest completed answer per finding, for the open-items list.
  const latest = new Map<string, FollowUpRecord>();
  for (const c of checks.filter((c) => c.status === "ai_report")) for (const fu of getFollowUps(c.id)) latest.set(fu.findingId, fu);

  return (
    <div className="rp-page" lang={lang}>
      <div className="container rp-wrap">
        <nav className="rp-crumbs" aria-label={t.histTitle}>
          <Link href={`/inspections/${id}/report`}>{t.reportTitle}</Link>
          <i className="bi bi-chevron-right" aria-hidden />
          <span aria-current="page">{t.histTitle}</span>
        </nav>
        <header className="rp-head">
          <div className="rp-head__main">
            <div className="eyebrow">{t.histTitle}</div>
            <h1 className="rp-title">{formatAddress(report.address, report.postalCode)}</h1>
            <p className="rp-lead">{t.histLead}</p>
            {report.fastanumer && (
              <div className="rp-head__meta">
                <span>
                  <i className="bi bi-123" aria-hidden />
                  {report.fastanumer}
                </span>
              </div>
            )}
          </div>
          <div className="rp-head__actions">
            <StartAnnualButton reportId={id} lang={lang} label={inProgress ? t.histContinue : t.histStart} />
          </div>
        </header>

        <div className="hist-grid">
          <section className={`card rp-card hist-due${overdue ? " is-overdue" : ""}`} aria-labelledby="hist-due">
            <div className="card-body">
              <h2 id="hist-due" className="rp-label">
                {t.histNextDue}
              </h2>
              <div className="hist-due__date">{dateFmt.format(new Date(due))}</div>
              {overdue ? (
                <Chip tone="warning" icon="bi-alarm">
                  {t.histOverdue}
                </Chip>
              ) : (
                <Chip tone="success" icon="bi-check2-circle">
                  {t.histConfirmedUntil.replace("{date}", dateFmt.format(new Date(due)))}
                </Chip>
              )}
            </div>
          </section>

          <section className="card rp-card hist-open" aria-labelledby="hist-open">
            <div className="card-body">
              <h2 id="hist-open" className="rp-label">
                {t.histOpenItems} <span className="hist-count">{open.length}</span>
              </h2>
              {open.length ? (
                <ul className="hist-items">
                  {open.map((f) => {
                    const fu = latest.get(f.id);
                    return (
                      <li key={f.id}>
                        <GradeBadge grade={f.grade} lang={lang} compact />
                        <div>
                          <div className="hist-items__title">{f.title}</div>
                          <div className="hist-items__meta">
                            {title(f.itemKey)} · {f.source === "owner" ? t.histFromOwner : t.histFromReport}
                            {fu?.answer && ` · ${fu.answer === "worse" ? t.annWorse : fu.answer === "fixed" ? t.annFixed : t.annUnchanged}`}
                            {fu?.verdict && ` · ${t.annVerdict}: ${FOLLOWUP_VERDICT_LABEL[fu.verdict.verdict][lang]}`}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mb-0">{t.histOpenNone}</p>
              )}
            </div>
          </section>
        </div>

        <section className="card rp-card mt-4" aria-labelledby="hist-tl">
          <div className="card-body">
            <h2 id="hist-tl" className="rp-label">
              {t.histTimeline}
            </h2>
            <ol className="hist-tl">
              {[...checks].reverse().map((c) => {
                const totals = annualTotals(getFollowUps(c.id), getAnswers(c.id));
                const doneAt = c.completedAt ?? c.createdAt;
                return (
                  <li key={c.id} className="hist-tl__row">
                    <span className="hist-tl__date">{dateFmt.format(new Date(doneAt))}</span>
                    <span className="hist-tl__dot is-annual" aria-hidden />
                    <div className="hist-tl__body">
                      <strong>{t.histAnnual}</strong>
                      {c.status === "capturing" ? (
                        <Chip tone="brand" icon="bi-pencil">
                          {t.histInProgress}
                        </Chip>
                      ) : (
                        <div className="hist-tl__meta">
                          {t.histResultLine
                            .replace("{fixed}", String(totals.fixed))
                            .replace("{unchanged}", String(totals.unchanged))
                            .replace("{worse}", String(totals.worse))
                            .replace("{problems}", String(totals.problems))}
                          {totals.contradicted > 0 && ` · ${t.histContradicted.replace("{n}", String(totals.contradicted))}`}
                        </div>
                      )}
                    </div>
                    <Link className="btn btn-sm btn-outline-primary" href={`/inspections/${c.id}/annual`}>
                      {t.histOpenCheck}
                    </Link>
                  </li>
                );
              })}
              <li className="hist-tl__row">
                <span className="hist-tl__date">{dateFmt.format(new Date(report.signedAt ?? report.createdAt))}</span>
                <span className="hist-tl__dot is-report" aria-hidden />
                <div className="hist-tl__body">
                  <strong>{t.histReport}</strong> <GradeBadge grade={overall} lang={lang} />
                  <div className="hist-tl__meta">
                    {TIER_LABEL[report.tier][lang]}
                    {report.reportHash && (
                      <>
                        {" · "}
                        {t.stdSealLabel} <span className="rp-mono">{shortFingerprint(report.reportHash)}</span>
                      </>
                    )}
                  </div>
                </div>
                <Link className="btn btn-sm btn-outline-primary" href={`/inspections/${id}/report`}>
                  {t.histOpenReport}
                </Link>
              </li>
            </ol>
          </div>
        </section>

        <ProblemsPanel inspectionId={id} lang={lang} problems={problems} />
      </div>
      <AskPanel inspectionId={id} lang={lang} demo={aiEngine() !== "claude"} />
    </div>
  );
}
