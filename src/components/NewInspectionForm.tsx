"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getDict } from "@/lib/i18n";
import {
  CONSTRUCTION_LABEL,
  HEATING_LABEL,
  STAGE_LABEL,
  PROPERTY_TYPE_LABEL,
  PURPOSE_LABEL,
  TIER_LABEL,
} from "@/lib/labels";
import { PLANS } from "@/lib/pricing";
import {
  CONSTRUCTION_STAGES,
  CONSTRUCTION_TYPES,
  HEATING_TYPES,
  PROPERTY_TYPES,
  PURPOSES,
  TIERS,
  type ConstructionStage,
  type ConstructionType,
  type HeatingType,
  type Lang,
  type PropertyType,
  type Purpose,
  type Tier,
} from "@/lib/types";

const PURPOSE_ICON: Record<Purpose, string> = { seller: "bi-signpost-2", buyer: "bi-key", owner: "bi-house-heart" };

/** Which plan features to show on each tier card (indexes into PLANS[…].features). */
const TIER_HIGHLIGHTS: Record<Tier, number[]> = { basic: [1, 4], verified: [1, 2] };

/** Plan features that state a limitation ("Not verified by a professional") get a neutral marker, not a tick. */
const isLimitation = (en: string) => en.startsWith("Not ");

export default function NewInspectionForm({ lang, initialTier }: { lang: Lang; initialTier: Tier }) {
  const t = getDict(lang);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badFields, setBadFields] = useState<string[]>([]);

  const [form, setForm] = useState({
    address: "",
    postalCode: "",
    fastanumer: "",
    propertyType: "fjolbyli" as PropertyType,
    buildYear: "",
    sizeM2: "",
    construction: "steypa" as ConstructionType,
    heating: "hitaveita" as HeatingType,
    hasBasement: false,
    hasAttic: false,
    hasGarage: false,
    hasFireplace: false,
    hasHotTub: false,
    constructionStage: "unknown" as ConstructionStage,
    purpose: "buyer" as Purpose,
    tier: initialTier,
    lang: lang as Lang,
    contactName: "",
    contactEmail: "",
    price: "",
    consent: false,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const invalid = (k: string) => (badFields.includes(k) ? " is-invalid" : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setBadFields([]);
    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: undefined,
          fastanumer: form.fastanumer || null,
          priceIsk: form.price.replace(/\D/g, "") ? Number(form.price.replace(/\D/g, "")) : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.[lang] ?? t.error);
        setBadFields(body.fields ?? []);
        return;
      }
      router.push(`/inspections/${body.id}`);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  const plan = PLANS.find((p) => p.key === form.tier);
  // Server-reported field names → label and input id, so the error can link to each field.
  const fieldLabel: Record<string, [string, string]> = {
    address: [t.fAddress, "address"],
    postalCode: [t.fPostalCode, "postalCode"],
    fastanumer: [t.fFastanumer, "fastanumer"],
    buildYear: [t.fBuildYear, "buildYear"],
    sizeM2: [t.fSize, "sizeM2"],
    priceIsk: [t.fPrice, "price"],
    contactName: [t.fName, "contactName"],
    contactEmail: [t.fEmail, "contactEmail"],
  };
  const badLinks = badFields.filter((f) => fieldLabel[f]);
  const nextSteps = [t.step1Title, t.step2Title, ...(form.tier === "verified" ? [t.step3Title] : [])];

  return (
    <form onSubmit={submit} noValidate className="sh-order">
      <div className="row g-4 gx-xl-5">
        <div className="col-lg-8 sh-order-main">
          <fieldset className="sh-fsection">
            <legend className="sh-fsection-head">
              <span className="sh-fsection-num">1</span>
              <span className="sh-fsection-title">{t.sectionProperty}</span>
            </legend>
            <p className="sh-fsection-hint">{t.shHintProperty}</p>
            <div className="row g-3">
              <div className="col-md-8">
                <label className="form-label" htmlFor="address">{t.fAddress}</label>
                <input id="address" className={`form-control${invalid("address")}`} required value={form.address} onChange={(e) => set("address", e.target.value)} autoComplete="street-address" />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="postalCode">{t.fPostalCode}</label>
                <input id="postalCode" className={`form-control${invalid("postalCode")}`} inputMode="numeric" maxLength={3} required value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="propertyType">{t.fPropertyType}</label>
                <select id="propertyType" className="form-select" value={form.propertyType} onChange={(e) => set("propertyType", e.target.value as PropertyType)}>
                  {PROPERTY_TYPES.map((p) => (
                    <option key={p} value={p}>{PROPERTY_TYPE_LABEL[p][lang]}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="fastanumer">{t.fFastanumer}</label>
                <input id="fastanumer" className={`form-control${invalid("fastanumer")}`} placeholder="F2012345" value={form.fastanumer} onChange={(e) => set("fastanumer", e.target.value)} aria-describedby="fastanumer-help" />
                <div id="fastanumer-help" className="form-text">{t.fFastanumerHelp}</div>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label" htmlFor="buildYear">{t.fBuildYear}</label>
                <input id="buildYear" className={`form-control${invalid("buildYear")}`} inputMode="numeric" maxLength={4} required value={form.buildYear} onChange={(e) => set("buildYear", e.target.value)} />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label" htmlFor="sizeM2">{t.fSize}</label>
                <input id="sizeM2" className={`form-control${invalid("sizeM2")}`} inputMode="decimal" required value={form.sizeM2} onChange={(e) => set("sizeM2", e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="construction">{t.fConstruction}</label>
                <select id="construction" className="form-select" value={form.construction} onChange={(e) => set("construction", e.target.value as ConstructionType)}>
                  {CONSTRUCTION_TYPES.map((c) => (
                    <option key={c} value={c}>{CONSTRUCTION_LABEL[c][lang]}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="heating">{t.fHeating}</label>
                <select id="heating" className="form-select" value={form.heating} onChange={(e) => set("heating", e.target.value as HeatingType)}>
                  {HEATING_TYPES.map((h) => (
                    <option key={h} value={h}>{HEATING_LABEL[h][lang]}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="constructionStage">{t.fStage}</label>
                <select id="constructionStage" className="form-select" value={form.constructionStage} onChange={(e) => set("constructionStage", e.target.value as ConstructionStage)} aria-describedby="stage-help">
                  {CONSTRUCTION_STAGES.map((s) => (
                    <option key={s} value={s}>{STAGE_LABEL[s][lang]}</option>
                  ))}
                </select>
                <div id="stage-help" className="form-text">{t.fStageHelp}</div>
              </div>
            </div>
          </fieldset>

          <fieldset className="sh-fsection">
            <legend className="sh-fsection-head">
              <span className="sh-fsection-num">2</span>
              <span className="sh-fsection-title">{t.shSectionExtras}</span>
            </legend>
            <p className="sh-fsection-hint">{t.shHintExtras}</p>
            <div className="form-label" id="has-label">{t.fHas}</div>
            <div className="sh-toggles" role="group" aria-labelledby="has-label">
              {(
                [
                  ["hasBasement", t.fBasement, "bi-box-seam"],
                  ["hasAttic", t.fAttic, "bi-house"],
                  ["hasGarage", t.fGarage, "bi-car-front"],
                  ["hasFireplace", t.fFireplace, "bi-fire"],
                  ["hasHotTub", t.fHotTub, "bi-water"],
                ] as const
              ).map(([key, label, icon]) => (
                <label className={`sh-toggle${form[key] ? " is-on" : ""}`} htmlFor={key} key={key}>
                  <input id={key} type="checkbox" className="form-check-input" checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
                  <i className={`bi ${icon}`} aria-hidden />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="sh-fsection">
            <legend className="sh-fsection-head">
              <span className="sh-fsection-num">3</span>
              <span className="sh-fsection-title">{t.shSectionPurposeTier}</span>
            </legend>
            <p className="sh-fsection-hint">{t.shHintPurposeTier}</p>

            <div className="form-label" id="purpose-label">{t.fPurpose}</div>
            <div className="sh-options sh-options-3" role="radiogroup" aria-labelledby="purpose-label">
              {PURPOSES.map((p) => (
                <label className={`sh-option${form.purpose === p ? " is-selected" : ""}`} htmlFor={`purpose-${p}`} key={p}>
                  <input id={`purpose-${p}`} type="radio" name="purpose" className="form-check-input" checked={form.purpose === p} onChange={() => set("purpose", p)} />
                  <i className={`bi ${PURPOSE_ICON[p]} sh-option-icon`} aria-hidden />
                  <span className="sh-option-label">{PURPOSE_LABEL[p][lang]}</span>
                </label>
              ))}
            </div>

            <div className="form-label mt-4" id="tier-label">{t.fTier}</div>
            <div className="sh-options sh-options-2" role="radiogroup" aria-labelledby="tier-label">
              {TIERS.map((tier) => {
                const p = PLANS.find((x) => x.key === tier);
                return (
                  <label className={`sh-tier${form.tier === tier ? " is-selected" : ""}`} htmlFor={`tier-${tier}`} key={tier}>
                    <span className="sh-tier-top">
                      <input id={`tier-${tier}`} type="radio" name="tier" className="form-check-input" checked={form.tier === tier} onChange={() => set("tier", tier)} />
                      <span className="sh-tier-name">{p ? p.name[lang] : TIER_LABEL[tier][lang]}</span>
                      {p?.highlighted && <span className="sh-tier-flag">{t.mostPopular}</span>}
                    </span>
                    {p && (
                      <span className="sh-tier-price">
                        {p.price[lang]} <span className="sh-tier-per">{p.per[lang]}</span>
                      </span>
                    )}
                    {p && (
                      <span className="sh-tier-features">
                        {TIER_HIGHLIGHTS[tier]
                          .map((i) => p.features[i])
                          .filter(Boolean)
                          .map((f) => (
                            <span key={f.en} className={`sh-tier-feature${isLimitation(f.en) ? " is-limit" : ""}`}>
                              <i className={`bi ${isLimitation(f.en) ? "bi-dash-circle" : "bi-check2"}`} aria-hidden />
                              {f[lang]}
                            </span>
                          ))}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="row g-3 mt-2">
              <div className="col-md-6">
                <label className="form-label" htmlFor="price">{t.fPrice}</label>
                <div className="input-group">
                  <input id="price" className={`form-control${invalid("priceIsk")}`} inputMode="numeric" placeholder="75.000.000" value={form.price} onChange={(e) => set("price", e.target.value)} aria-describedby="price-help" />
                  <span className="input-group-text">kr.</span>
                </div>
                <div id="price-help" className="form-text">{t.fPriceHelp}</div>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="reportLang">{t.fLang}</label>
                <select id="reportLang" className="form-select" value={form.lang} onChange={(e) => set("lang", e.target.value as Lang)}>
                  <option value="is">Íslenska</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="sh-fsection">
            <legend className="sh-fsection-head">
              <span className="sh-fsection-num">4</span>
              <span className="sh-fsection-title">{t.sectionContact}</span>
            </legend>
            <p className="sh-fsection-hint">{t.shHintContact}</p>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="contactName">{t.fName}</label>
                <input id="contactName" className={`form-control${invalid("contactName")}`} required value={form.contactName} onChange={(e) => set("contactName", e.target.value)} autoComplete="name" />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="contactEmail">{t.fEmail}</label>
                <input id="contactEmail" type="email" className={`form-control${invalid("contactEmail")}`} required value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} autoComplete="email" />
              </div>
            </div>
          </fieldset>
        </div>

        <div className="col-lg-4">
          <aside className="sh-summary">
            <div className="sh-summary-card">
              <p className="eyebrow mb-3">{t.shOrderSummary}</p>
              {plan && (
                <>
                  <div className="sh-summary-plan">
                    <div>
                      <p className="sh-summary-name">{plan.name[lang]}</p>
                      <p className="sh-summary-per">{plan.per[lang]}</p>
                    </div>
                    <p className="sh-summary-price">{plan.price[lang]}</p>
                  </div>
                  <ul className="sh-summary-features">
                    {plan.features.map((f) => (
                      <li key={f.en} className={isLimitation(f.en) ? "is-limit" : undefined}>
                        <i className={`bi ${isLimitation(f.en) ? "bi-dash-circle" : "bi-check2"}`} aria-hidden />
                        <span>{f[lang]}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className={`sh-consent${form.consent ? " is-on" : ""}${badFields.includes("consent") ? " is-invalid" : ""}`}>
                <div className="form-check mb-0">
                  <input id="consent" type="checkbox" className={`form-check-input${invalid("consent")}`} checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />
                  <label className="form-check-label" htmlFor="consent">{t.fConsent}</label>
                </div>
              </div>

              {error && (
                <div className="sh-callout sh-callout-danger" role="alert">
                  <i className="bi bi-exclamation-circle" aria-hidden />
                  <div>
                    {error}
                    {badLinks.length > 0 && (
                      <ul className="sh-error-fields">
                        {badLinks.map((f) => (
                          <li key={f}>
                            <a href={`#${fieldLabel[f][1]}`}>{fieldLabel[f][0]}</a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg w-100 sh-submit" disabled={busy || !form.consent}>
                {busy && <span className="spinner-border spinner-border-sm me-2" aria-hidden />}
                {busy ? t.creating : t.createBtn}
                {!busy && <i className="bi bi-arrow-right ms-2" aria-hidden />}
              </button>
              {!form.consent && <p className="sh-submit-hint">{t.shConsentHint}</p>}
              <p className="sh-summary-note">{t.pricingNote}</p>
            </div>

            <div className="sh-next">
              <p className="sh-next-title">{t.shNextTitle}</p>
              <ol className="sh-next-list">
                {nextSteps.map((s, i) => (
                  <li key={s}>
                    <span className="sh-next-num">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </form>
  );
}
