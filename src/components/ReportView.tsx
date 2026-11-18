import type { CSSProperties, ReactNode } from "react";
import FindingView from "./FindingView";
import GradeBadge from "./GradeBadge";
import PrintButton from "./PrintButton";
import { conditionLegend, conditionMapItems, itemState } from "@/components/report/conditionItems";
import {
  Chip,
  GRADE_ORDER,
  PhotoStrip,
  SectionHead,
  SegBar,
  StatusChip,
  Swatch,
  describeParts,
  gradeParts,
  itemColor,
  type ChipTone,
  type SegPart,
} from "@/components/report/ui";
import { ConditionMap3D, type ConditionItemState } from "@/components/three";
import { AREA_LABEL, getTemplate, type Area } from "@/lib/checklist";
import { COST_TABLE_VERIFIED, formatIsk, getCost } from "@/lib/costs";
import { GRADE_COLOR, STATE_COLOR } from "@/lib/gradeColors";
import { getDict, type Dict } from "@/lib/i18n";
import {
  CONSTRUCTION_LABEL,
  FOLLOW_UP_LABEL,
  HEATING_LABEL,
  PROPERTY_TYPE_LABEL,
  PURPOSE_LABEL,
  STAGE_LABEL,
  STAGE_NOTE,
  STATUS_LABEL,
  TIER_LABEL,
} from "@/lib/labels";
import { drawingArchive } from "@/lib/municipal";
import { buildReport, type ItemSection } from "@/lib/report";
import type { FollowUp, InspectionBundle, Lang } from "@/lib/types";
import { formatAddress } from "@/lib/postcodes";

const pct = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)} %`;

const STAGE_STYLE: Record<"success" | "warning" | "danger" | "secondary", { tone: ChipTone; icon: string }> = {
  success: { tone: "success", icon: "bi-check-circle" },
  warning: { tone: "warning", icon: "bi-exclamation-triangle" },
  danger: { tone: "danger", icon: "bi-exclamation-octagon" },
  secondary: { tone: "neutral", icon: "bi-question-circle" },
};

const FOLLOW_UP_ICON: Record<FollowUp, string> = {
  none: "bi-check2",
  moisture_measurement: "bi-droplet-half",
  mold_sampling: "bi-virus",
  sewer_camera: "bi-camera-video",
  electrician: "bi-lightning-charge",
  plumber: "bi-wrench-adjustable",
  roofer: "bi-house-up",
  structural_engineer: "bi-buildings",
  ventilation_specialist: "bi-wind",
};

interface Row {
  s: ItemSection;
  state: ConditionItemState;
  /** Gets a full card: analysed, or has findings or photos. The rest are listed compactly. */
  rich: boolean;
}

interface CompactEntry {
  key: string;
  title: string;
  state: ConditionItemState;
}

/** Full condition report. Rendered in the report's own language. */
export default function ReportView({ bundle }: { bundle: InspectionBundle }) {
  const { inspection } = bundle;
  const lang = inspection.lang;
  const t = getDict(lang);
  const r = buildReport(bundle);
  const verified = inspection.status === "verified";
  const dateFmt = new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "long" });
  const itemTitle = (key: string) => getTemplate(key)?.title[lang] ?? key;

  // The checklist grouped by area, in report order.
  const groups: { area: Area; rows: Row[] }[] = [];
  for (const s of r.sections) {
    const state = itemState(s.item);
    let g = groups.find((x) => x.area === s.template.area);
    if (!g) {
      g = { area: s.template.area, rows: [] };
      groups.push(g);
    }
    g.rows.push({ s, state, rich: state === "analyzed" || s.findings.length > 0 || s.photoIds.length > 0 });
  }
  // Items without a template (not expected) still get an anchor for the condition map.
  const listed = new Set(r.sections.map((s) => s.item.itemKey));
  const orphans = bundle.items.filter((i) => !listed.has(i.itemKey));

  const mapItems = conditionMapItems([...groups.flatMap((g) => g.rows.map((row) => row.s.item)), ...orphans], bundle.findings, lang);
  const legend = conditionLegend(t, lang);

  const totalFindings = GRADE_ORDER.reduce((n, g) => n + r.counts[g], 0);
  const grades = gradeParts(r.counts, lang);
  const coverage = { analyzed: 0, skipped: 0, pending: 0 };
  for (const m of mapItems) coverage[m.state]++;
  const coverageParts: SegPart[] = [
    { key: "analyzed", label: t.rpAssessed, value: coverage.analyzed, color: "var(--brand)" },
    { key: "skipped", label: t.rpLegendSkipped, value: coverage.skipped, color: STATE_COLOR.skipped },
    { key: "pending", label: t.rpLegendPending, value: coverage.pending, color: STATE_COLOR.pending },
  ];
  const legendEntries = [
    ...GRADE_ORDER.map((g) => ({ key: g, label: legend[g], color: GRADE_COLOR[g].solid })),
    { key: "skipped", label: legend.skipped, color: STATE_COLOR.skipped },
    { key: "pending", label: legend.pending, color: STATE_COLOR.pending },
  ];

  const facts: { label: string; value: ReactNode; wide?: boolean }[] = [
    { label: t.fPropertyType, value: PROPERTY_TYPE_LABEL[inspection.propertyType][lang] },
    { label: t.fBuildYear, value: inspection.buildYear },
    { label: t.fSize.replace(/\s*\(.*\)/, ""), value: `${inspection.sizeM2} m²` },
    { label: t.fConstruction, value: CONSTRUCTION_LABEL[inspection.construction][lang] },
    { label: t.fHeating, value: HEATING_LABEL[inspection.heating][lang] },
    { label: t.fPurpose, value: PURPOSE_LABEL[inspection.purpose][lang] },
    ...(inspection.fastanumer ? [{ label: t.fFastanumer.replace(/ \(.*\)/, ""), value: inspection.fastanumer }] : []),
    { label: t.created, value: dateFmt.format(new Date(inspection.createdAt)) },
    { label: t.inspectionId, value: <span className="rp-mono">{inspection.id}</span>, wide: true },
  ];

  const stage = inspection.constructionStage ?? "unknown";
  const stageNote = STAGE_NOTE[stage];
  const archive = drawingArchive(inspection.postalCode);

  return (
    <div className="rp-page">
      <div className="container rp-wrap">
        <header className="rp-head">
          <div className="rp-printbrand" aria-hidden>
            <i className="bi bi-house-check-fill" />
            {t.brand}
          </div>
          <div className="rp-head__main">
            <div className="eyebrow">{t.reportTitle}</div>
            <h1 className="rp-title">
              {formatAddress(inspection.address, inspection.postalCode)}
            </h1>
            <div className="rp-head__chips">
              <StatusChip status={inspection.status} lang={lang} />
              <Chip tone="outline" icon={inspection.tier === "verified" ? "bi-person-check" : "bi-stars"}>
                {TIER_LABEL[inspection.tier][lang]}
              </Chip>
            </div>
          </div>
          <div className="rp-head__actions no-print">
            {(inspection.status === "ai_report" || verified) && (
              <a href={`/inspections/${inspection.id}/negotiate`} className="btn btn-primary">
                <i className="bi bi-arrow-left-right me-2" aria-hidden />
                {t.negLink}
              </a>
            )}
            <PrintButton label={t.print} />
          </div>
        </header>

        <div className="rp-stack">
          {r.usedMock && (
            <div className="rp-callout rp-callout--danger" role="note">
              <i className="bi bi-exclamation-octagon" aria-hidden />
              <div>{t.demoBanner}</div>
            </div>
          )}

          <div className="rp-top">
            <section className="card rp-card" aria-labelledby="rp-property">
              <div className="card-body">
                <h2 id="rp-property" className="eyebrow rp-cardlabel">
                  {t.property}
                </h2>
                <dl className="rp-facts">
                  {facts.map((f) => (
                    <div key={f.label} className={`rp-fact${f.wide ? " rp-fact--wide" : ""}`}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <aside className={`card rp-card rp-seal ${verified ? "rp-seal--verified" : "rp-seal--draft"}`} aria-labelledby="rp-seal">
              <div className="card-body">
                <div className="rp-seal__top">
                  <span className="rp-seal__stamp" aria-hidden>
                    <i className={`bi ${verified ? "bi-patch-check-fill" : inspection.status === "in_review" ? "bi-hourglass-split" : "bi-robot"}`} />
                  </span>
                  <div>
                    <div className="eyebrow rp-cardlabel mb-1">{t.rpSealTitle}</div>
                    <h2 id="rp-seal" className="rp-seal__title">
                      {STATUS_LABEL[inspection.status][lang]}
                    </h2>
                  </div>
                </div>
                {verified ? (
                  <dl className="rp-seal__rows">
                    <div>
                      <dt>{t.verifiedBy}</dt>
                      <dd>{inspection.inspectorName}</dd>
                    </div>
                    <div>
                      <dt>{t.license}</dt>
                      <dd>{inspection.inspectorLicense}</dd>
                    </div>
                    {inspection.signedAt && (
                      <div>
                        <dt>{t.signedAt}</dt>
                        <dd>{dateFmt.format(new Date(inspection.signedAt))}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="rp-seal__text">{t.draftWarning}</p>
                )}
              </div>
            </aside>
          </div>

          <div className="rp-overview">
            <section className="card rp-card rp-overview__summary" aria-labelledby="rp-overview">
              <div className="card-body">
                <SectionHead id="rp-overview" icon="bi-bar-chart-line" title={t.gradeOverview} />
                <div className="rp-stat">
                  <span className="rp-stat__value">{totalFindings}</span>
                  <span className="rp-stat__label">{t.rpFindingsTotal}</span>
                </div>
                <SegBar parts={grades} ariaLabel={`${t.gradeOverview}: ${describeParts(grades)}`} />
                <ul className="rp-grades">
                  {GRADE_ORDER.map((g) => (
                    <li key={g} className={r.counts[g] === 0 ? "is-zero" : undefined}>
                      <GradeBadge grade={g} lang={lang} />
                      <span className="rp-grades__n">{r.counts[g]}</span>
                    </li>
                  ))}
                </ul>

                <div className="rp-coverage">
                  <div className="rp-coverage__head">
                    <h3 className="rp-label mb-0">{t.rpCoverage}</h3>
                    <span className="rp-coverage__total">
                      {t.rpAssessed} <strong>{coverage.analyzed}</strong> / {mapItems.length}
                    </span>
                  </div>
                  <SegBar parts={coverageParts} ariaLabel={`${t.rpCoverage}: ${describeParts(coverageParts)}`} />
                  <ul className="rp-keys">
                    {coverageParts.map((p) => (
                      <li key={p.key}>
                        <Swatch color={p.color} />
                        {p.label} <strong>{p.value}</strong>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* The map has its own legend on screen; in print (map hidden) this is the key for the colours. */}
                <ul className="rp-keys rp-legend rp-printonly">
                  {legendEntries.map((e) => (
                    <li key={e.key}>
                      <Swatch color={e.color} />
                      {e.label}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="card rp-card rp-mapcard no-print" aria-labelledby="rp-map">
              <div className="card-body">
                <div className="rp-map-head">
                  <h2 id="rp-map" className="rp-map-title">
                    <i className="bi bi-house-door" aria-hidden />
                    {t.rpMapTitle}
                  </h2>
                  <p className="rp-map-hint">{t.rpMapHint}</p>
                </div>
                <div className="rp-map">
                  <ConditionMap3D items={mapItems} ariaLabel={t.rpMapAria} legend={legend} />
                </div>
              </div>
            </section>
          </div>

          {inspection.summary && (
            <section className="card rp-card" aria-labelledby="rp-summary">
              <div className="card-body">
                <SectionHead
                  id="rp-summary"
                  icon="bi-card-text"
                  title={t.summary}
                  aside={
                    <Chip tone="ai" icon="bi-stars">
                      {t.aiFinding}
                    </Chip>
                  }
                />
                <div className={`rp-summary${inspection.summary.keyRisks.length ? "" : " rp-summary--single"}`}>
                  <div className="rp-prose">
                    <p>{inspection.summary.overall}</p>
                    <h3 className="rp-subhead">
                      <i className="bi bi-lightbulb" aria-hidden />
                      {t.advice}
                    </h3>
                    <p className="mb-0">{inspection.summary.advice}</p>
                  </div>
                  {inspection.summary.keyRisks.length > 0 && (
                    <div className="rp-panel rp-panel--risk">
                      <h3 className="rp-subhead">
                        <i className="bi bi-exclamation-triangle" aria-hidden />
                        {t.keyRisks}
                      </h3>
                      <ul className="rp-risks">
                        {inspection.summary.keyRisks.map((k) => (
                          <li key={k}>{k}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {r.followUps.length > 0 && (
            <section className="card rp-card" aria-labelledby="rp-followups">
              <div className="card-body">
                <SectionHead id="rp-followups" icon="bi-clipboard2-pulse" title={t.followUps} />
                <ul className="rp-followups">
                  {r.followUps.map((f) => (
                    <li key={f.followUp} className="rp-followup">
                      <span className="rp-followup__icon" aria-hidden>
                        <i className={`bi ${FOLLOW_UP_ICON[f.followUp]}`} />
                      </span>
                      <div className="rp-followup__body">
                        <div className="rp-followup__title">{FOLLOW_UP_LABEL[f.followUp][lang]}</div>
                        {f.itemKeys.length > 0 && (
                          <div className="rp-followup__items">
                            {f.itemKeys.map((k) => (
                              <a key={k} href={`#item-${k}`} className="rp-linkchip">
                                {itemTitle(k)}
                              </a>
                            ))}
                          </div>
                        )}
                        {f.baselineReason && (
                          <p className="rp-followup__reason">
                            <strong>{t.basedOnAge}:</strong> {f.baselineReason[lang]}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {r.costLines.length > 0 && (
            <section className="card rp-card" aria-labelledby="rp-costs">
              <div className="card-body">
                <SectionHead id="rp-costs" icon="bi-calculator" title={t.costTitle} />
                {!COST_TABLE_VERIFIED && (
                  <div className="rp-callout mb-3">
                    <i className="bi bi-info-circle" aria-hidden />
                    <div>{t.costUnverified}</div>
                  </div>
                )}
                <div className="table-responsive">
                  <table className="rp-table">
                    <thead>
                      <tr>
                        <th scope="col">{t.rpDocItem}</th>
                        <th scope="col" className="num">
                          {t.estimate}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.costLines.map((l) => (
                        <tr key={l.findingId}>
                          <td>
                            <div className="rp-table__title">{l.title}</div>
                            <div className="rp-table__sub">
                              <a href={`#item-${l.itemKey}`}>{itemTitle(l.itemKey)}</a> · {getCost(l.costKey)?.label[lang]}
                            </div>
                          </td>
                          <td className="num">
                            {formatIsk(l.minIsk, lang)} – {formatIsk(l.maxIsk, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="rp-total">
                        <th scope="row">{t.costTotal}</th>
                        <td className="num">
                          {formatIsk(r.costMin, lang)} – {formatIsk(r.costMax, lang)}
                        </td>
                      </tr>
                      {inspection.priceIsk && (
                        <tr className="rp-share">
                          <th scope="row">
                            {t.costShare} ({formatIsk(inspection.priceIsk, lang)})<div className="rp-table__sub">{t.costShareNote}</div>
                          </th>
                          <td className="num">
                            {pct(r.costMin, inspection.priceIsk)} – {pct(r.costMax, inspection.priceIsk)}
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              </div>
            </section>
          )}

          <section className="card rp-card" aria-labelledby="rp-official">
            <div className="card-body">
              <SectionHead id="rp-official" icon="bi-bank" title={t.officialTitle} />
              <div className="rp-official">
                <div>
                  <h3 className="rp-label">{t.stageLabel}</h3>
                  <Chip tone={STAGE_STYLE[stageNote.tone].tone} icon={STAGE_STYLE[stageNote.tone].icon}>
                    {STAGE_LABEL[stage][lang]}
                  </Chip>
                  <p className="rp-official__text">{stageNote.text[lang]}</p>
                </div>
                <div>
                  <h3 className="rp-label">{t.drawingsLabel}</h3>
                  <p className="rp-official__text mt-0">{t.drawingsText}</p>
                  {archive ? (
                    <a className="rp-extlink" href={archive.url} target="_blank" rel="noreferrer">
                      {archive.name[lang]}
                      <i className="bi bi-box-arrow-up-right" aria-hidden />
                    </a>
                  ) : (
                    <p className="rp-official__text text-secondary mb-0">{t.drawingsOther}</p>
                  )}
                </div>
              </div>
              <div className="rp-callout rp-callout--info mt-4">
                <i className="bi bi-file-earmark-text" aria-hidden />
                <div>{t.docsToRequest}</div>
              </div>
            </div>
          </section>

          <section className="rp-components" aria-labelledby="rp-components">
            <SectionHead id="rp-components" icon="bi-grid-1x2" title={t.componentsTitle} />
            {groups.map((g) => {
              const assessed = g.rows.filter((row) => row.state === "analyzed").length;
              const compact = g.rows.filter((row) => !row.rich);
              return (
                <section key={g.area} className="rp-area" aria-labelledby={`rp-area-${g.area}`}>
                  <div className="rp-area__head">
                    <h3 id={`rp-area-${g.area}`} className="rp-area__title">
                      {AREA_LABEL[g.area][lang]}
                    </h3>
                    <span className="rp-area__rule" aria-hidden />
                    <span className="rp-area__count">
                      {t.rpAssessed} {assessed}/{g.rows.length}
                    </span>
                  </div>
                  {g.rows
                    .filter((row) => row.rich)
                    .map((row) => (
                      <ItemCard key={row.s.item.itemKey} row={row} lang={lang} t={t} />
                    ))}
                  {compact.length > 0 && (
                    <CompactList
                      t={t}
                      entries={compact.map(({ s, state }) => ({ key: s.item.itemKey, title: s.template.title[lang], state }))}
                    />
                  )}
                </section>
              );
            })}
            {orphans.length > 0 && (
              <div className="rp-area">
                <CompactList t={t} entries={orphans.map((i) => ({ key: i.itemKey, title: i.itemKey, state: itemState(i) }))} />
              </div>
            )}
          </section>

          {verified && inspection.inspectorStatement && (
            <section className="card rp-card rp-signoff" aria-labelledby="rp-signoff">
              <div className="card-body">
                <SectionHead id="rp-signoff" icon="bi-pen" title={t.signStatement} />
                <blockquote className="rp-signoff__quote">{inspection.inspectorStatement}</blockquote>
                <div className="rp-signoff__sig">
                  <span className="rp-signoff__mark" aria-hidden>
                    <i className="bi bi-patch-check-fill" />
                  </span>
                  <div>
                    <div className="rp-signoff__name">{inspection.inspectorName}</div>
                    <div className="rp-signoff__meta">
                      {t.license} {inspection.inspectorLicense}
                      {inspection.signedAt && (
                        <>
                          {" "}
                          · {t.signedAt} {dateFmt.format(new Date(inspection.signedAt))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="rp-limits" aria-labelledby="rp-limits">
            <h2 id="rp-limits" className="rp-limits__title">
              <i className="bi bi-info-circle" aria-hidden />
              {t.limitationsTitle}
            </h2>
            <p className="mb-0">{t.limitationsText}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

/** An inspected item: grade-coloured accent, AI summary, findings and photos. */
function ItemCard({ row, lang, t }: { row: Row; lang: Lang; t: Dict }) {
  const { s, state } = row;
  const key = s.item.itemKey;
  const skipped = state === "skipped";
  const accent = { "--rp-accent": itemColor(s.worst, state) } as CSSProperties;
  return (
    <article id={`item-${key}`} className="rp-item" style={accent} aria-labelledby={`rp-item-${key}`}>
      <header className="rp-item__head">
        <div>
          <h4 id={`rp-item-${key}`} className="rp-item__title">
            {s.template.title[lang]}
          </h4>
          {(s.findings.length > 0 || s.photoIds.length > 0) && (
            <div className="rp-item__meta">
              {s.findings.length > 0 && (
                <span>
                  <i className="bi bi-list-check" aria-hidden />
                  {t.rpFindings}: {s.findings.length}
                </span>
              )}
              {s.photoIds.length > 0 && (
                <span>
                  <i className="bi bi-images" aria-hidden />
                  {t.photosForItem}: {s.photoIds.length}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="rp-item__grade">
          {skipped ? (
            <GradeBadge grade="TGIU" lang={lang} />
          ) : s.worst ? (
            <GradeBadge grade={s.worst} lang={lang} />
          ) : state === "analyzed" ? (
            <Chip tone="success" icon="bi-check2">
              {t.rpLegendOk}
            </Chip>
          ) : (
            <Chip tone="neutral" icon="bi-hourglass">
              {t.rpLegendPending}
            </Chip>
          )}
        </div>
      </header>
      {skipped && (
        <p className="rp-item__summary">
          {t.notAssessed}: {t.notAccessible.toLowerCase()}
        </p>
      )}
      {s.item.analysis?.itemSummary && !skipped && <p className="rp-item__summary">{s.item.analysis.itemSummary}</p>}
      {s.findings.length > 0 && (
        <div className="rp-item__findings">
          {s.findings.map((f) => (
            <FindingView key={f.id} finding={f} lang={lang} photoNumbers={f.photoIds.map((pid) => s.photoIds.indexOf(pid) + 1).filter((n) => n > 0)} />
          ))}
        </div>
      )}
      {s.photoIds.length > 0 && <PhotoStrip ids={s.photoIds} label={t.photosForItem} alt={(i) => `${t.photo} ${i + 1}`} />}
    </article>
  );
}

/** Items that were not assessed, condensed to one row each (each row keeps its #item-<key> anchor). */
function CompactList({ entries, t }: { entries: CompactEntry[]; t: Dict }) {
  return (
    <div className="rp-compact">
      <div className="rp-compact__head">
        <span>{t.notAssessed}</span>
        <span className="rp-compact__count">{entries.length}</span>
      </div>
      <ul className="rp-compact__list">
        {entries.map((e) => (
          <li key={e.key} id={`item-${e.key}`} className="rp-compact__row">
            <Swatch color={itemColor(null, e.state)} />
            <span className="rp-compact__name">{e.title}</span>
            <span className="rp-compact__status">{e.state === "skipped" ? t.rpLegendSkipped : t.rpLegendPending}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
