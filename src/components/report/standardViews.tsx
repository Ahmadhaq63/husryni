/**
 * Report sections for the report standard (src/lib/standard.ts): overall grade with its published
 * rule, the ten building systems, moisture readings and the independence/seal block.
 * Server- and client-safe (no hooks). Styles: src/styles/standard.css.
 */
import GradeBadge from "../GradeBadge";
import { Chip, SectionHead } from "./ui";
import { formatIsk } from "@/lib/costs";
import type { Dict } from "@/lib/i18n";
import {
  formatReading,
  MOISTURE_LEVEL_LABEL,
  MOISTURE_METHOD_LABEL,
  moistureLevel,
  moistureScaleText,
  OVERALL_RULE,
  overallReasonText,
  shortFingerprint,
  standardLabel,
  SYSTEM_ICON,
  SYSTEM_LABEL,
  WATER_DAMAGE_SYSTEMS,
  type OverallResult,
  type SystemStatus,
  type SystemTone,
} from "@/lib/standard";
import type { Grade, Inspection, Lang, MoistureReading } from "@/lib/types";

const TONE_TEXT = (t: Dict): Record<SystemTone, string> => ({
  red: t.stdSysRed,
  amber: t.stdSysAmber,
  green: t.stdSysGreen,
  grey: t.stdSysGrey,
  none: t.stdSysNone,
});

/** Overall grade, why, and the rule that produced it. A signed report shows the grade fixed at signing. */
export function OverallGrade({
  overall,
  frozen,
  standardVersion,
  lang,
  t,
  itemTitle,
}: {
  overall: OverallResult;
  /** Grade stored at signing (null for unsigned reports). */
  frozen: Grade | null;
  /** The standard the report follows; null for a report signed before the standard existed (no chip then). */
  standardVersion: string | null;
  lang: Lang;
  t: Dict;
  itemTitle: (key: string) => string;
}) {
  const grade = frozen ?? overall.grade;
  return (
    <div className="std-overall">
      <div className="std-overall__badge">
        <GradeBadge grade={grade} lang={lang} />
      </div>
      <div className="std-overall__body">
        <h2 className="std-overall__label">{t.stdOverall}</h2>
        <p className="std-overall__reason">{overallReasonText(overall, lang, itemTitle)}</p>
        <p className="std-overall__how">{frozen ? t.stdOverallFrozen : t.stdOverallComputed}</p>
        <div className="std-overall__chips">
          {standardVersion && (
            <Chip tone="outline" icon="bi-journal-check">
              {standardLabel(lang, standardVersion)}
            </Chip>
          )}
          {overall.notAssessed.length > 0 && (
            <Chip tone="neutral" icon="bi-slash-circle">
              {t.stdNotAssessedCount.replace("{n}", String(overall.notAssessed.length))}
            </Chip>
          )}
        </div>
        <details className="std-rule">
          <summary>{t.stdShowRule}</summary>
          <p>{OVERALL_RULE[lang]}</p>
        </details>
        <p className="std-rule-print">{OVERALL_RULE[lang]}</p>
      </div>
    </div>
  );
}

/** The ten building systems as traffic lights; the same ten in every report. */
export function SystemsGrid({ systems, lang, t }: { systems: SystemStatus[]; lang: Lang; t: Dict }) {
  const toneText = TONE_TEXT(t);
  return (
    <div className="std-systems">
      <div className="std-systems__head">
        <h2 className="std-systems__title">{t.stdSystemsTitle}</h2>
        <p className="std-systems__lead">{t.stdSystemsLead}</p>
      </div>
      <ul className="std-systems__grid">
        {systems.map((s) => (
          <li key={s.system} className={`std-sys std-sys--${s.tone}`}>
            <div className="std-sys__top">
              <span className="std-sys__icon" aria-hidden>
                <i className={`bi ${SYSTEM_ICON[s.system]}`} />
              </span>
              <span className="std-sys__name">{SYSTEM_LABEL[s.system][lang]}</span>
              {WATER_DAMAGE_SYSTEMS.includes(s.system) && (
                <span className="std-sys__water" title={t.stdSysWater}>
                  <i className="bi bi-droplet-fill" aria-hidden />
                  <span className="visually-hidden">{t.stdSysWater}</span>
                </span>
              )}
            </div>
            <div className="std-sys__status">
              <span className="std-sys__light" aria-hidden />
              {toneText[s.tone]}
            </div>
            {s.findingTitles.length > 0 && <p className="std-sys__detail">{s.findingTitles.slice(0, 2).join(" · ")}</p>}
            {s.itemKeys.length > 0 && (
              <p className="std-sys__count">{t.stdSysItems.replace("{a}", String(s.assessed)).replace("{n}", String(s.itemKeys.length))}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MoistureSection({
  readings,
  lang,
  t,
  itemTitle,
}: {
  readings: MoistureReading[];
  lang: Lang;
  t: Dict;
  itemTitle: (key: string) => string;
}) {
  return (
    <section className="card rp-card" aria-labelledby="rp-moisture">
      <div className="card-body">
        <SectionHead id="rp-moisture" icon="bi-moisture" title={t.stdMoistTitle} />
        <p className="std-moist__lead">{t.stdMoistLead}</p>
        <div className="table-responsive">
          <table className="rp-table std-moist__table">
            <thead>
              <tr>
                <th scope="col">{t.stdMoistRoom}</th>
                <th scope="col">{t.stdMoistPart}</th>
                <th scope="col" className="num">
                  {t.stdMoistValue}
                </th>
                <th scope="col">{t.stdMoistLevel}</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => {
                const level = moistureLevel(r.value);
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="rp-table__title">{r.room}</div>
                      {r.itemKey && (
                        <div className="rp-table__sub">
                          <a href={`#item-${r.itemKey}`}>{itemTitle(r.itemKey)}</a>
                        </div>
                      )}
                    </td>
                    <td>
                      {r.part}
                      <div className="rp-table__sub">{MOISTURE_METHOD_LABEL[r.method][lang]}</div>
                    </td>
                    <td className="num">{formatReading(r.value, lang)}</td>
                    <td>
                      <span className={`std-level std-level--${level}`}>{MOISTURE_LEVEL_LABEL[level][lang]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="std-moist__scale mt-2 mb-0">{moistureScaleText(lang)}</p>
      </div>
    </section>
  );
}

/** Independence declaration, fixed fee and the seal (fingerprint) of a signed report. */
export function SealBlock({ inspection, lang, t, verifyHref }: { inspection: Inspection; lang: Lang; t: Dict; verifyHref: string }) {
  if (!inspection.reportHash) return null;
  const dateFmt = new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "long", timeStyle: "short" });
  return (
    <div className="std-seal">
      <h3 className="std-seal__title">
        <i className="bi bi-shield-lock" aria-hidden />
        {t.stdSealTitle}
      </h3>
      <ul className="std-seal__list">
        {inspection.declaredAt && (
          <li>
            <i className="bi bi-check2-circle" aria-hidden />
            {t.stdDeclMade} · {dateFmt.format(new Date(inspection.declaredAt))}
          </li>
        )}
        <li>
          <i className="bi bi-cash-coin" aria-hidden />
          {t.stdFixedFee}: {inspection.feeIsk != null ? formatIsk(inspection.feeIsk, lang) : t.stdFeeQuoted} · {t.stdFeeIndependent}
        </li>
        {inspection.standardVersion && (
          <li>
            <i className="bi bi-journal-check" aria-hidden />
            {standardLabel(lang, inspection.standardVersion)}
          </li>
        )}
      </ul>
      <div className="std-seal__fp">
        <span className="std-seal__fplabel">{t.stdSealLabel}</span>
        <code className="std-seal__code">{shortFingerprint(inspection.reportHash)}</code>
        <a className="std-seal__verify" href={verifyHref}>
          {t.stdSealVerify}
          <i className="bi bi-arrow-right-short" aria-hidden />
        </a>
        <span className="std-seal__url rp-printonly">{verifyHref}</span>
      </div>
      <p className="std-seal__note">{t.stdSealNote}</p>
    </div>
  );
}
