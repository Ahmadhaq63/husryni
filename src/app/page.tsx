import Link from "next/link";
import GradeBadge from "@/components/GradeBadge";
import { HouseHero } from "@/components/three";
import { getDict } from "@/lib/i18n";
import { GRADE_INFO } from "@/lib/labels";
import { PLANS } from "@/lib/pricing";
import { getLang } from "@/lib/server/session";
import type { L10n } from "@/lib/types";

/** The graded part of the scale; TGIU ("not assessed") is shown beside it. */
const SCALE = ["TG0", "TG1", "TG2", "TG3"] as const;

/** Plan features that state a limitation ("Not verified by a professional") get a neutral marker, not a tick. */
const isLimitation = (f: L10n) => f.en.startsWith("Not ");

export default async function Home() {
  const lang = await getLang();
  const t = getDict(lang);
  const basic = PLANS.find((p) => p.key === "basic");

  const trust = [
    { icon: "bi-bar-chart-steps", title: t.shTrustGrades, text: t.shTrustGradesSub },
    { icon: "bi-patch-check", title: t.shTrustVerified, text: t.shTrustVerifiedSub },
    { icon: "bi-tag", title: basic ? `${t.shTrustFrom} ${basic.price[lang]}` : t.pricingTitle, text: t.shTrustPriceSub },
    { icon: "bi-shield-lock", title: t.shTrustPrivacy, text: t.shTrustPrivacySub },
  ];
  const steps = [
    { icon: "bi-phone", title: t.step1Title, text: t.step1Text, ai: false },
    { icon: "bi-stars", title: t.step2Title, text: t.step2Text, ai: true },
    { icon: "bi-patch-check", title: t.step3Title, text: t.step3Text, ai: false },
  ];
  const why = [
    { icon: "bi-bank", title: t.why1Title, text: t.why1Text },
    { icon: "bi-cash-coin", title: t.why2Title, text: t.why2Text },
    { icon: "bi-droplet-half", title: t.why3Title, text: t.why3Text },
  ];
  const faq = [
    { q: t.faq1Q, a: t.faq1A },
    { q: t.faq2Q, a: t.faq2A },
    { q: t.faq3Q, a: t.faq3A },
  ];

  return (
    <div className="sh-page sh-landing">
      <section className="sh-hero">
        <div className="container">
          <div className="row align-items-center gy-5 gx-lg-5">
            <div className="col-lg-6">
              <p className="eyebrow sh-hero-eyebrow">
                <span className="sh-hero-eyebrow-dot" aria-hidden />
                {t.tagline}
              </p>
              <h1 className="sh-hero-title">{t.heroTitle}</h1>
              <p className="sh-hero-lead">{t.heroLead}</p>
              <div className="sh-hero-ctas">
                <Link href="/inspections/new" className="btn btn-primary btn-lg">
                  <i className="bi bi-camera me-2" aria-hidden />
                  {t.heroCta}
                </Link>
                <a href="#how" className="btn btn-lg sh-btn-quiet">
                  {t.heroSecondary}
                  <i className="bi bi-arrow-down-short ms-1" aria-hidden />
                </a>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="sh-hero-visual">
                <HouseHero
                  className="sh-hero-scene"
                  ariaLabel={t.shHeroAria}
                  labels={{
                    roof: t.shHeroRoof,
                    windows: t.shHeroWindows,
                    facade: t.shHeroFacade,
                    foundation: t.shHeroFoundation,
                    wetRooms: t.shHeroWetRooms,
                    technical: t.shHeroTechnical,
                  }}
                  details={{
                    roof: t.heroRoof,
                    windows: t.heroWindows,
                    facade: t.heroFacade,
                    foundation: t.heroFoundation,
                    wetRooms: t.heroWetRooms,
                    technical: t.heroTechnical,
                  }}
                  ui={{ back: t.drnHome, explore: t.heroExplore, check: t.heroCheck }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container sh-trust-wrap">
        <ul className="sh-trust">
          {trust.map((item) => (
            <li className="sh-trust-item" key={item.title}>
              <span className="sh-icon-tile sh-icon-tile-sm" aria-hidden>
                <i className={`bi ${item.icon}`} />
              </span>
              <div>
                <p className="sh-trust-title">{item.title}</p>
                <p className="sh-trust-text">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <section id="how" className="sh-section">
        <div className="container">
          <div className="sh-section-head">
            <p className="eyebrow">{t.shHowEyebrow}</p>
            <h2 className="sh-h2">{t.howTitle}</h2>
          </div>
          <ol className="sh-steps">
            {steps.map((s, i) => (
              <li className={`sh-step${s.ai ? " is-ai" : ""}`} key={s.title}>
                <div className="sh-step-marker" aria-hidden>
                  <span className="sh-step-num">{i + 1}</span>
                  <span className="sh-step-line" />
                </div>
                <div className="sh-step-card">
                  <div className="sh-step-top">
                    <span className="sh-icon-tile" aria-hidden>
                      <i className={`bi ${s.icon}`} />
                    </span>
                    {s.ai && <span className="sh-ai-badge">{t.aiFinding}</span>}
                  </div>
                  <h3 className="sh-h3">
                    <span className="visually-hidden">
                      {t.shStepLabel} {i + 1}:{" "}
                    </span>
                    {s.title}
                  </h3>
                  <p className="sh-step-text">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="more" className="sh-section sh-more-wrap">
        <div className="container">
          <div className="sh-section-head">
            <p className="eyebrow">{t.moreEyebrow}</p>
            <h2 className="sh-h2">{t.moreTitle}</h2>
            <p className="sh-section-lead">{t.moreLead}</p>
          </div>
          <ul className="sh-more">
            {[
              { icon: "bi-crosshair", title: t.more1Title, text: t.more1Text },
              { icon: "bi-shield-lock", title: t.more2Title, text: t.more2Text },
              { icon: "bi-signpost-split", title: t.more3Title, text: t.more3Text },
              { icon: "bi-calendar2-check", title: t.more4Title, text: t.more4Text },
              { icon: "bi-share", title: t.more5Title, text: t.more5Text },
              { icon: "bi-chat-dots", title: t.more6Title, text: t.more6Text },
            ].map((f) => (
              <li className="sh-more-card" key={f.title}>
                <span className="sh-icon-tile sh-icon-tile-lg" aria-hidden>
                  <i className={`bi ${f.icon}`} />
                </span>
                <h3 className="sh-h3">{f.title}</h3>
                <p className="sh-more-text">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="grades" className="sh-section bg-surface-2">
        <div className="container">
          <div className="sh-section-head">
            <p className="eyebrow">{t.shGradesEyebrow}</p>
            <h2 className="sh-h2">{t.shGradesTitle}</h2>
            <p className="sh-section-lead">{t.shGradesLead}</p>
          </div>
          <div className="sh-scale">
            <ol className="sh-scale-steps">
              {SCALE.map((g) => (
                <li className={`sh-scale-step sh-scale-${g}`} key={g}>
                  <span className="sh-scale-bar" aria-hidden />
                  <div className="sh-scale-body">
                    <GradeBadge grade={g} lang={lang} />
                    <p className="sh-scale-text">{GRADE_INFO[g].meaning[lang]}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="sh-scale-step sh-scale-iu">
              <span className="sh-scale-bar" aria-hidden />
              <div className="sh-scale-body">
                <GradeBadge grade="TGIU" lang={lang} />
                <p className="sh-scale-text">{GRADE_INFO.TGIU.meaning[lang]}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sh-section">
        <div className="container">
          <div className="row gy-5 gx-lg-5">
            <div className="col-lg-4">
              <div className="sh-why-head">
                <p className="eyebrow">{t.shWhyEyebrow}</p>
                <h2 className="sh-h2">{t.whyTitle}</h2>
                <p className="sh-section-lead mb-0">{t.shWhyLead}</p>
              </div>
            </div>
            <div className="col-lg-8">
              <ul className="sh-why">
                {why.map((w) => (
                  <li className="sh-why-item" key={w.title}>
                    <span className="sh-icon-tile sh-icon-tile-lg" aria-hidden>
                      <i className={`bi ${w.icon}`} />
                    </span>
                    <div>
                      <h3 className="sh-h3">{w.title}</h3>
                      <p className="sh-why-text">{w.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="sh-section bg-surface-2">
        <div className="container">
          <div className="sh-section-head sh-section-head-center">
            <p className="eyebrow">{t.shPricingEyebrow}</p>
            <h2 className="sh-h2">{t.pricingTitle}</h2>
            <p className="sh-section-note">{t.pricingNote}</p>
          </div>
          <div className="row g-4 sh-plans">
            {PLANS.map((p) => (
              <div className="col-lg-4" key={p.key}>
                <article className={`sh-plan${p.highlighted ? " is-featured" : ""}`}>
                  {p.highlighted && <span className="sh-plan-flag">{t.mostPopular}</span>}
                  <h3 className="sh-plan-name">{p.name[lang]}</h3>
                  <p className="sh-plan-price">{p.price[lang]}</p>
                  <p className="sh-plan-per">{p.per[lang]}</p>
                  <ul className="sh-plan-features">
                    {p.features.map((f) => {
                      const limit = isLimitation(f);
                      return (
                        <li key={f.en} className={limit ? "is-limit" : undefined}>
                          <i className={`bi ${limit ? "bi-dash-circle" : "bi-check-circle-fill"}`} aria-hidden />
                          <span>{f[lang]}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {p.key !== "agency" && (
                    <Link
                      href={`/inspections/new?tier=${p.key}`}
                      className={`btn btn-lg w-100 ${p.highlighted ? "btn-primary" : "btn-outline-primary"}`}
                    >
                      {t.heroCta}
                    </Link>
                  )}
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="sh-section">
        <div className="container sh-narrow">
          <div className="sh-section-head sh-section-head-center">
            <p className="eyebrow">{t.shFaqEyebrow}</p>
            <h2 className="sh-h2">{t.faqTitle}</h2>
          </div>
          <div className="sh-faq">
            {faq.map((f) => (
              <details key={f.q} className="sh-faq-item">
                <summary>
                  <span>{f.q}</span>
                  <span className="sh-faq-chevron" aria-hidden>
                    <i className="bi bi-chevron-down" />
                  </span>
                </summary>
                <p className="sh-faq-answer">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="sh-cta-wrap no-print">
        <div className="container">
          <div className="sh-cta">
            <i className="bi bi-house-check sh-cta-mark" aria-hidden />
            <div className="sh-cta-copy">
              <h2 className="sh-cta-title">{t.shCtaTitle}</h2>
              <p className="sh-cta-text">{t.shCtaText}</p>
            </div>
            <div className="sh-cta-actions">
              <Link href="/inspections/new" className="btn btn-lg sh-btn-on-dark">
                <i className="bi bi-camera me-2" aria-hidden />
                {t.heroCta}
              </Link>
              <a href="#pricing" className="btn btn-lg sh-btn-ghost-light">
                {t.shCtaPricing}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
