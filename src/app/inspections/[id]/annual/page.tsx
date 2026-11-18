import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AnnualClient, { type AnnualFollowUpView, type AnnualQuestionView } from "@/components/AnnualClient";
import GradeBadge from "@/components/GradeBadge";
import { Chip } from "@/components/report/ui";
import { ANNUAL_QUESTIONS, annualTotals, FOLLOWUP_VERDICT_LABEL, followUpPhotoKey, isContradicted, nextDue, questionPhotoKey } from "@/lib/annual";
import { getAnswers, getFollowUps } from "@/lib/annualRepo";
import { getTemplate } from "@/lib/checklist";
import { getDict } from "@/lib/i18n";
import { formatAddress } from "@/lib/postcodes";
import { getBundle, getFinding, listItemPhotos } from "@/lib/repo";
import type { Finding } from "@/lib/types";

/** The owner's yearly check: the form while it is open, the results once submitted. */
export default async function AnnualPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = getBundle(id);
  if (!bundle) notFound();
  const check = bundle.inspection;
  if (check.kind !== "annual" || !check.parentId) redirect(`/inspections/${id}`);
  const lang = check.lang;
  const t = getDict(lang);
  const title = (key: string) => getTemplate(key)?.title[lang] ?? key;
  const dateFmt = new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "long" });

  const followups = getFollowUps(id);
  const answers = getAnswers(id);
  const findings = new Map<string, Finding>();
  for (const fu of followups) {
    const f = getFinding(fu.findingId);
    if (f) findings.set(f.id, f);
  }
  const beforeOf = (f: Finding) => (f.photoIds.length ? f.photoIds : listItemPhotos(f.inspectionId, f.itemKey).map((p) => p.id));

  const views: AnnualFollowUpView[] = followups.flatMap((fu) => {
    const f = findings.get(fu.findingId);
    if (!f) return [];
    return [
      {
        findingId: f.id,
        title: f.title,
        description: f.description,
        itemTitle: title(f.itemKey),
        grade: f.grade,
        fromOwner: f.source === "owner",
        recordedAtText: new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "medium", timeZone: "Atlantic/Reykjavik" }).format(
          new Date(f.createdAt),
        ),
        beforePhotoIds: beforeOf(f),
        afterPhotoIds: listItemPhotos(id, followUpPhotoKey(f.id)).map((p) => p.id),
        answer: fu.answer,
        note: fu.note,
        verdict: fu.verdict,
      },
    ];
  });
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  const questions: AnnualQuestionView[] = ANNUAL_QUESTIONS.map((q) => ({
    id: q.id,
    text: q.text[lang],
    problemAnswer: q.problemAnswer,
    answer: byQ.get(q.id)?.answer ?? null,
    note: byQ.get(q.id)?.note ?? "",
    photoIds: listItemPhotos(id, questionPhotoKey(q.id)).map((p) => p.id),
  }));
  const done = check.status !== "capturing";
  const totals = annualTotals(followups, answers);
  const demo = followups.some((fu) => fu.verdict?.engine === "mock");

  return (
    <div className="rp-page" lang={lang}>
      <div className="container rp-wrap rp-wrap--narrow">
        <nav className="rp-crumbs" aria-label={t.histTitle}>
          <Link href={`/inspections/${check.parentId}/history`}>{t.histTitle}</Link>
          <i className="bi bi-chevron-right" aria-hidden />
          <span aria-current="page">{t.annTitle}</span>
        </nav>
        <header className="rp-head">
          <div className="rp-head__main">
            <div className="eyebrow">{t.annTitle}</div>
            <h1 className="rp-title">{formatAddress(check.address, check.postalCode)}</h1>
            <p className="rp-lead">{done ? t.annDoneLead.replace("{date}", dateFmt.format(new Date(nextDue(check.completedAt ?? check.createdAt)))) : t.annLead}</p>
          </div>
        </header>

        {demo && (
          <div className="rp-callout rp-callout--danger mb-3" role="note">
            <i className="bi bi-exclamation-octagon" aria-hidden />
            <div>{t.demoBanner}</div>
          </div>
        )}

        {!done ? (
          <AnnualClient annualId={id} lang={lang} followups={views} questions={questions} />
        ) : (
          <div className="ann">
            <section className="card rp-card" aria-labelledby="ann-done">
              <div className="card-body">
                <h2 id="ann-done" className="ann__h">
                  <i className="bi bi-patch-check" aria-hidden />
                  {t.annDoneTitle}
                </h2>
                <p className="ann__totals">
                  {t.histResultLine
                    .replace("{fixed}", String(totals.fixed))
                    .replace("{unchanged}", String(totals.unchanged))
                    .replace("{worse}", String(totals.worse))
                    .replace("{problems}", String(totals.problems))}
                  {totals.unsure > 0 && ` · ${t.annUnsure}: ${totals.unsure}`}
                </p>
                {totals.contradicted > 0 && (
                  <div className="rp-callout rp-callout--warning">
                    <i className="bi bi-exclamation-triangle" aria-hidden />
                    <div>{t.histContradicted.replace("{n}", String(totals.contradicted))}</div>
                  </div>
                )}
              </div>
            </section>
            {views.length > 0 && (
              <section className="card rp-card" aria-labelledby="ann-follow-done">
                <div className="card-body">
                  <h2 id="ann-follow-done" className="ann__h">
                    {t.annFollowTitle}
                  </h2>
                  <ul className="ann__results">
                    {views.map((v) => (
                      <li key={v.findingId} className={isContradicted(v) ? "is-contradicted" : undefined}>
                        <GradeBadge grade={v.grade} lang={lang} compact />
                        <div className="ann__rbody">
                          <strong>{v.title}</strong>
                          <div className="ann__rmeta">
                            {v.itemTitle}
                            {v.note && ` · ${v.note}`}
                          </div>
                          {v.verdict && (
                            <div className="ann__rmeta">
                              <i className="bi bi-stars" aria-hidden /> {t.annVerdict}: {FOLLOWUP_VERDICT_LABEL[v.verdict.verdict][lang]}
                            </div>
                          )}
                        </div>
                        <Chip tone={v.answer === "fixed" ? "success" : v.answer === "worse" ? "danger" : "warning"}>
                          {v.answer === "fixed" ? t.annFixed : v.answer === "worse" ? t.annWorse : t.annUnchanged}
                        </Chip>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
            <section className="card rp-card" aria-labelledby="ann-new">
              <div className="card-body">
                <h2 id="ann-new" className="ann__h">
                  {t.annNewProblems}
                </h2>
                {bundle.findings.filter((f) => f.source === "owner").length ? (
                  <ul className="ann__results">
                    {bundle.findings
                      .filter((f) => f.source === "owner")
                      .map((f) => (
                        <li key={f.id}>
                          <GradeBadge grade={f.grade} lang={lang} compact />
                          <div className="ann__rbody">
                            <strong>{f.title}</strong>
                            <div className="ann__rmeta">
                              {title(f.itemKey)} · {f.description}
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="mb-0">{t.annNoNew}</p>
                )}
              </div>
            </section>
            <Link href={`/inspections/${check.parentId}/history`} className="btn btn-outline-primary align-self-start">
              <i className="bi bi-arrow-left me-2" aria-hidden />
              {t.annBack}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
