import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { getTemplate } from "@/lib/checklist";
import { formatIsk } from "@/lib/costs";
import { GRADE_COLOR } from "@/lib/gradeColors";
import { getDict } from "@/lib/i18n";
import { ACTION_LABEL } from "@/lib/negotiationLabels";
import { computeTotals, estimateIsk, LEGAL_REFERENCE, negotiableFindings, negotiationOpen } from "@/lib/negotiation";
import { getNegotiation, listRemedies } from "@/lib/negotiationRepo";
import { getBundle } from "@/lib/repo";
import type { RemedyAction } from "@/lib/types";

const ORDER: RemedyAction[] = ["seller_fix", "price_reduction", "hoa", "accept"];

/** Printable request for the realtor, in the report's language. */
export default async function NegotiationDocument({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = getBundle(id);
  if (!bundle) notFound();
  const { inspection } = bundle;
  if (!negotiationOpen(inspection.status)) redirect(`/inspections/${id}`);

  const lang = inspection.lang;
  const t = getDict(lang);
  const L = ACTION_LABEL(t);
  const negotiation = getNegotiation(id);
  const remedies = listRemedies(id);
  const findings = negotiableFindings(bundle);
  const totals = computeTotals(findings, remedies, negotiation?.ownerSharePct ?? null);
  const dateFmt = new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "long" });
  const pct = (n: number) => (inspection.priceIsk ? ` (${((n / inspection.priceIsk) * 100).toFixed(1)} % ${t.ofPrice})` : "");
  const share = negotiation?.ownerSharePct ?? null;

  return (
    <div className="rp-page rp-docpage">
      <div className="container rp-wrap rp-wrap--doc">
        <div className="rp-doctools no-print">
          <Link href={`/inspections/${id}/negotiate`} className="btn btn-link px-0">
            <i className="bi bi-arrow-left me-2" aria-hidden />
            {t.negTitle}
          </Link>
          <PrintButton label={t.print} className="btn-primary" />
        </div>

        <article className="rp-sheet">
          <header className="rp-letterhead">
            <div className="rp-letterhead__brand">
              <i className="bi bi-house-check-fill" aria-hidden />
              {t.brand}
            </div>
            <div className="rp-letterhead__ref">
              {t.docReport} · <span className="rp-mono">{inspection.id}</span>
            </div>
          </header>

          <h1 className="rp-doc__title">{t.docTitle}</h1>

          <dl className="rp-doc__meta">
            <div>
              <dt>{t.fAddress}</dt>
              <dd>
                {inspection.address}, {inspection.postalCode}
              </dd>
            </div>
            {inspection.fastanumer && (
              <div>
                <dt>{t.fFastanumer.replace(/ \(.*\)/, "")}</dt>
                <dd>{inspection.fastanumer}</dd>
              </div>
            )}
            {inspection.status === "verified" && inspection.inspectorName && (
              <div>
                <dt>{t.verifiedBy}</dt>
                <dd>
                  {inspection.inspectorName} ({t.license} {inspection.inspectorLicense})
                </dd>
              </div>
            )}
            {negotiation?.responseDeadline && (
              <div>
                <dt>{t.deadline}</dt>
                <dd>{dateFmt.format(new Date(negotiation.responseDeadline))}</dd>
              </div>
            )}
          </dl>
          {inspection.status !== "verified" && (
            <p className="rp-doc__warn">
              <i className="bi bi-exclamation-triangle" aria-hidden />
              {t.draftWarning}
            </p>
          )}

          <p className="rp-doc__intro">{t.docIntro}</p>
          {negotiation?.note && <blockquote className="rp-doc__note">{negotiation.note}</blockquote>}

          {ORDER.map((action) => {
            const group = findings.filter((f) => remedies.get(f.id)?.action === action);
            if (!group.length) return null;
            return (
              <section key={action} className="rp-doc__group">
                <h2 className="rp-doc__h2">{L[action]}</h2>
                <table className="rp-table rp-doc__table">
                  <thead>
                    <tr>
                      <th scope="col" className="rp-doc__n">
                        #
                      </th>
                      <th scope="col">{t.rpDocItem}</th>
                      <th scope="col" className="num">
                        {action === "price_reduction" ? t.amountIsk : t.estimate}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((f, i) => {
                      const r = remedies.get(f.id)!;
                      const est = estimateIsk(f);
                      const amount =
                        action === "price_reduction"
                          ? (r.amountIsk ?? est)
                          : action === "hoa" && share != null
                            ? Math.round((est * share) / 100)
                            : est;
                      return (
                        <tr key={f.id}>
                          <td className="rp-doc__n">{i + 1}.</td>
                          <td>
                            <div className="rp-doc__item">
                              <span className="rp-doc__grade" style={{ background: GRADE_COLOR[f.grade].solid }} aria-hidden />
                              <strong>{f.title}</strong>
                              <span className="rp-doc__sub">
                                {getTemplate(f.itemKey)?.title[lang] ?? f.itemKey} · {f.grade}
                              </span>
                            </div>
                            <div className="rp-doc__desc">{f.description}</div>
                            {r.remark && <div className="rp-doc__remark">{r.remark}</div>}
                          </td>
                          <td className="num">{amount ? formatIsk(amount, lang) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })}

          <section className="rp-doc__totals">
            <table className="rp-table">
              <tbody>
                <tr>
                  <th scope="row">{t.totPriceReduction}</th>
                  <td className="num">
                    {formatIsk(totals.priceReduction, lang)}
                    {pct(totals.priceReduction)}
                  </td>
                </tr>
                <tr>
                  <th scope="row">{t.totSellerFix}</th>
                  <td className="num">{formatIsk(totals.sellerFixValue, lang)}</td>
                </tr>
                <tr className="rp-total">
                  <th scope="row">{t.totRequested}</th>
                  <td className="num">
                    {formatIsk(totals.requestedFromSeller, lang)}
                    {pct(totals.requestedFromSeller)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <div className="rp-doc__sigs">
            {[t.docSigBuyer, t.docSigSeller].map((label) => (
              <div key={label} className="rp-doc__sig">
                <div className="rp-doc__line" />
                <div className="rp-doc__siglabel">{label}</div>
                <div className="rp-doc__line rp-doc__line--date" />
                <div className="rp-doc__siglabel">{t.docDate}</div>
              </div>
            ))}
          </div>

          <footer className="rp-doc__legal">
            <h2 className="rp-doc__legaltitle">{t.legalTitle}</h2>
            <p>{LEGAL_REFERENCE.proposal2pct[lang]}</p>
            <p>{LEGAL_REFERENCE.caseLaw[lang]}</p>
            <p className="mb-0">{t.limitationsText}</p>
          </footer>
        </article>
      </div>
    </div>
  );
}
