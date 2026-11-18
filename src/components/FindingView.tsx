import GradeBadge from "./GradeBadge";
import { getDict } from "@/lib/i18n";
import { CONFIDENCE_LABEL, FOLLOW_UP_LABEL, URGENCY_LABEL } from "@/lib/labels";
import type { Finding, Lang } from "@/lib/types";

/**
 * Read-only rendering of one finding (used in capture, report and review screens):
 * a grade-coloured accent, the title and description, the recommended action, then
 * timeframe, further check, AI confidence and photo references. Styles: .rp-finding in report.css.
 */
export default function FindingView({
  finding,
  lang,
  photoNumbers = [],
  showSource = false,
}: {
  finding: Finding;
  lang: Lang;
  photoNumbers?: number[];
  showSource?: boolean;
}) {
  const t = getDict(lang);
  const rejected = finding.reviewStatus === "rejected";
  const ai = finding.source === "ai";
  return (
    <div className={`finding finding-${finding.grade} rp-finding rp-accent--${finding.grade}${rejected ? " finding-rejected" : ""}`}>
      <div className="rp-finding__head">
        <GradeBadge grade={finding.grade} lang={lang} />
        {showSource && (
          <span className={`rp-chip ${ai ? "rp-chip--ai" : "rp-chip--neutral"}`}>
            <i className={`bi ${ai ? "bi-stars" : "bi-person-badge"}`} aria-hidden />
            {ai ? t.aiFinding : t.inspectorFinding}
          </span>
        )}
        {rejected && (
          <span className="rp-chip rp-chip--neutral">
            <i className="bi bi-x-circle" aria-hidden />
            {t.rejected}
          </span>
        )}
      </div>
      <div className="rp-finding__title">{finding.title}</div>
      {finding.description && <p className="rp-finding__desc">{finding.description}</p>}
      {(finding.cause || finding.consequence) && (
        <dl className="rp-finding__cc">
          {finding.cause && (
            <div>
              <dt>{t.stdCause}</dt>
              <dd>{finding.cause}</dd>
            </div>
          )}
          {finding.consequence && (
            <div>
              <dt>{t.stdConsequence}</dt>
              <dd>{finding.consequence}</dd>
            </div>
          )}
        </dl>
      )}
      {finding.recommendedAction && (
        <div className="rp-finding__action">
          <i className="bi bi-tools" aria-hidden />
          <div>
            <span className="rp-finding__label">{t.action}:</span> {finding.recommendedAction}
          </div>
        </div>
      )}
      <ul className="rp-finding__meta">
        <li>
          <i className="bi bi-clock" aria-hidden />
          {t.urgency}: <strong>{URGENCY_LABEL[finding.urgency][lang]}</strong>
        </li>
        {finding.followUp !== "none" && (
          <li>
            <i className="bi bi-search" aria-hidden />
            {t.followUp}: <strong>{FOLLOW_UP_LABEL[finding.followUp][lang]}</strong>
          </li>
        )}
        {ai && (
          <li className="rp-finding__confidence">
            <i className="bi bi-stars" aria-hidden />
            {CONFIDENCE_LABEL[finding.confidence][lang]}
          </li>
        )}
        {photoNumbers.length > 0 && (
          <li>
            <i className="bi bi-image" aria-hidden />
            {t.photo} {photoNumbers.join(", ")}
          </li>
        )}
      </ul>
      {finding.inspectorNote && (
        <div className="rp-finding__note">
          <i className="bi bi-person-badge" aria-hidden />
          <span>
            <span className="visually-hidden">{t.inspectorNote}: </span>
            {finding.inspectorNote}
          </span>
        </div>
      )}
    </div>
  );
}
