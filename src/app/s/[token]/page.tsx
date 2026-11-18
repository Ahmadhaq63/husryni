import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import GradeBadge from "@/components/GradeBadge";
import SellerItemControls from "@/components/SellerClient";
import { getTemplate } from "@/lib/checklist";
import { formatIsk } from "@/lib/costs";
import { GRADE_COLOR } from "@/lib/gradeColors";
import { getDict } from "@/lib/i18n";
import { ACTION_LABEL } from "@/lib/negotiationLabels";
import { estimateIsk, negotiableFindings, negotiationOpen } from "@/lib/negotiation";
import { fixItemKey, getNegotiationByToken, listRemedies } from "@/lib/negotiationRepo";
import { getBundle } from "@/lib/repo";
import { getLang } from "@/lib/server/session";
import type { RemedyAction } from "@/lib/types";
import { formatAddress } from "@/lib/postcodes";

const ORDER: RemedyAction[] = ["seller_fix", "price_reduction", "hoa", "accept"];
const ACTION_ICON: Record<RemedyAction, string> = {
  seller_fix: "bi-tools",
  price_reduction: "bi-percent",
  hoa: "bi-buildings",
  accept: "bi-check2",
  none: "bi-dash-circle",
};

/** Seller / realtor view of the buyer's requests (capability link). */
export default async function SellerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const negotiation = getNegotiationByToken(token);
  const bundle = negotiation ? getBundle(negotiation.inspectionId) : null;
  if (!negotiation || !bundle || !negotiationOpen(bundle.inspection.status, bundle.inspection.kind)) notFound();

  const lang = await getLang();
  const t = getDict(lang);
  const L = ACTION_LABEL(t);
  const { inspection } = bundle;
  const remedies = listRemedies(inspection.id);
  const requested = negotiableFindings(bundle).filter((f) => (remedies.get(f.id)?.action ?? "none") !== "none");
  const dateFmt = new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "long" });

  return (
    <div className="rp-page">
      <div className="container rp-wrap rp-wrap--narrow">
        <header className="rp-head">
          <div className="rp-head__main">
            <div className="eyebrow">{t.sellerTitle}</div>
            <h1 className="rp-title">
              {formatAddress(inspection.address, inspection.postalCode)}
            </h1>
            <p className="rp-lead">{t.sellerLead}</p>
          </div>
        </header>

        {(negotiation.responseDeadline || negotiation.note) && (
          <div className="rp-brief">
            {negotiation.responseDeadline && (
              <div className="rp-brief__deadline">
                <span className="rp-brief__icon" aria-hidden>
                  <i className="bi bi-calendar-event" />
                </span>
                <div>
                  <div className="rp-label mb-0">{t.deadline}</div>
                  <div className="rp-brief__date">{dateFmt.format(new Date(negotiation.responseDeadline))}</div>
                </div>
              </div>
            )}
            {negotiation.note && (
              <figure className="rp-brief__note">
                <figcaption className="rp-label mb-1">{t.rpBuyerNote}</figcaption>
                <blockquote className="mb-0">{negotiation.note}</blockquote>
              </figure>
            )}
          </div>
        )}

        {ORDER.map((action) => {
          const group = requested.filter((f) => remedies.get(f.id)!.action === action);
          if (!group.length) return null;
          return (
            <section key={action} className="rp-sgroup" aria-labelledby={`sg-${action}`}>
              <div className="rp-area__head">
                <h2 id={`sg-${action}`} className="rp-area__title">
                  <i className={`bi ${ACTION_ICON[action]} me-2`} aria-hidden />
                  {L[action]}
                </h2>
                <span className="rp-area__rule" aria-hidden />
                <span className="rp-area__count">{group.length}</span>
              </div>
              {group.map((f) => {
                const r = remedies.get(f.id)!;
                const before = f.photoIds.length ? f.photoIds : bundle.photos.filter((p) => p.itemKey === f.itemKey).map((p) => p.id);
                return (
                  <article key={f.id} className="card rp-negitem" style={{ "--rp-accent": GRADE_COLOR[f.grade].solid } as CSSProperties} aria-labelledby={`sr-${f.id}`}>
                    <div className="card-body">
                      <div className="rp-negitem__head">
                        <div className="rp-negitem__heading">
                          <div className="rp-negitem__item">{getTemplate(f.itemKey)?.title[lang] ?? f.itemKey}</div>
                          <h3 id={`sr-${f.id}`} className="rp-negitem__title">
                            <GradeBadge grade={f.grade} lang={lang} compact />
                            <span>{f.title}</span>
                          </h3>
                        </div>
                        {action === "price_reduction" && (
                          <div className="rp-negitem__est">
                            <div className="rp-negitem__estlabel">{t.amountIsk}</div>
                            <div className="rp-negitem__amount">{formatIsk(r.amountIsk ?? estimateIsk(f), lang)}</div>
                          </div>
                        )}
                      </div>
                      <p className="rp-negitem__desc">{f.description}</p>
                      {r.remark && <blockquote className="rp-quote">“{r.remark}”</blockquote>}
                      {before.length > 0 && (
                        <div className="rp-sbefore">
                          <div className="rp-label">{t.before}</div>
                          <ul className="rp-photos rp-photos--sm mt-0">
                            {before.slice(0, 4).map((pid, i) => (
                              <li key={pid}>
                                <a href={`/api/photos/${pid}`} target="_blank" rel="noreferrer" className="rp-photo">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={`/api/photos/${pid}`} alt={`${t.before} ${i + 1}`} loading="lazy" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <SellerItemControls
                        token={token}
                        findingId={f.id}
                        lang={lang}
                        remedy={r}
                        afterPhotoIds={bundle.photos.filter((p) => p.itemKey === fixItemKey(f.id)).map((p) => p.id)}
                      />
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
        {requested.length === 0 && (
          <div className="rp-callout">
            <i className="bi bi-info-circle" aria-hidden />
            <div>{t.noNegotiable}</div>
          </div>
        )}
      </div>
    </div>
  );
}
