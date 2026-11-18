/**
 * Small presentational pieces shared by the report, inspector, negotiation and seller pages.
 * No hooks and no server-only imports, so both Server and Client Components can use them.
 * Styles: src/styles/report.css.
 */
import type { ReactNode } from "react";
import { GRADE_COLOR, STATE_COLOR } from "@/lib/gradeColors";
import { GRADE_INFO, STATUS_LABEL } from "@/lib/labels";
import type { Grade, InspectionStatus, Lang } from "@/lib/types";

/** Grades from most to least severe; the order of every grade list and bar in the report. */
export const GRADE_ORDER: Grade[] = ["TG3", "TG2", "TG1", "TG0", "TGIU"];

export type ChipTone = "neutral" | "outline" | "brand" | "success" | "warning" | "danger" | "info" | "ai";

export function Chip({ tone = "neutral", icon, children, title }: { tone?: ChipTone; icon?: string; children: ReactNode; title?: string }) {
  return (
    <span className={`rp-chip rp-chip--${tone}`} title={title}>
      {icon && <i className={`bi ${icon}`} aria-hidden />}
      {children}
    </span>
  );
}

const STATUS_STYLE: Record<InspectionStatus, { tone: ChipTone; icon: string }> = {
  capturing: { tone: "neutral", icon: "bi-camera" },
  in_review: { tone: "brand", icon: "bi-hourglass-split" },
  ai_report: { tone: "warning", icon: "bi-robot" },
  verified: { tone: "success", icon: "bi-patch-check-fill" },
};

export function StatusChip({ status, lang }: { status: InspectionStatus; lang: Lang }) {
  const s = STATUS_STYLE[status];
  return (
    <Chip tone={s.tone} icon={s.icon}>
      {STATUS_LABEL[status][lang]}
    </Chip>
  );
}

/** Section heading with an icon tile; `aside` sits at the right (chips, links). */
export function SectionHead({ icon, title, id, aside }: { icon: string; title: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <div className="rp-sechead">
      <span className="rp-sechead__icon" aria-hidden>
        <i className={`bi ${icon}`} />
      </span>
      <h2 id={id} className="rp-sechead__title">
        {title}
      </h2>
      {aside && <div className="rp-sechead__aside">{aside}</div>}
    </div>
  );
}

export function Swatch({ color }: { color: string }) {
  return <span className="rp-swatch" style={{ background: color }} aria-hidden />;
}

export interface SegPart {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * Thin segmented bar: one whole split into parts, widths proportional to the values.
 * Parts at zero draw nothing; the accessible name lists every part.
 */
export function SegBar({ parts, ariaLabel }: { parts: SegPart[]; ariaLabel: string }) {
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="rp-segbar" role="img" aria-label={ariaLabel}>
      {shown.length === 0 ? (
        <span className="rp-segbar__seg rp-segbar__seg--empty" />
      ) : (
        shown.map((p) => <span key={p.key} className="rp-segbar__seg" style={{ flexGrow: p.value, background: p.color }} title={`${p.label}: ${p.value}`} />)
      )}
    </div>
  );
}

export function gradeParts(counts: Record<Grade, number>, lang: Lang): SegPart[] {
  return GRADE_ORDER.map((g) => ({ key: g, label: GRADE_INFO[g].label[lang], value: counts[g], color: GRADE_COLOR[g].solid }));
}

export const describeParts = (parts: SegPart[]) => parts.map((p) => `${p.label}: ${p.value}`).join(", ");

/** Colour of an item on the condition map: its worst grade, or its state. */
export function itemColor(grade: Grade | null, state: "analyzed" | "skipped" | "pending") {
  if (grade) return GRADE_COLOR[grade].solid;
  return state === "analyzed" ? STATE_COLOR.ok : STATE_COLOR[state];
}

/** Numbered photo thumbnails that open the full photo. */
export function PhotoStrip({ ids, label, alt, size }: { ids: string[]; label?: string; alt: (i: number) => string; size?: "sm" }) {
  return (
    <ul className={`rp-photos${size === "sm" ? " rp-photos--sm" : ""}`} aria-label={label}>
      {ids.map((pid, i) => (
        <li key={pid}>
          <a href={`/api/photos/${pid}`} target="_blank" rel="noreferrer" className="rp-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${pid}`} alt={alt(i)} loading="lazy" />
            <span className="rp-photo__num" aria-hidden>
              {i + 1}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
