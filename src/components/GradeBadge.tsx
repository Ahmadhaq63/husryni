import { GRADE_INFO } from "@/lib/labels";
import type { Grade, Lang } from "@/lib/types";

/** Pill badge in the Nordic TG colours (styles: .grade-badge in src/styles/theme.css). */
export default function GradeBadge({ grade, lang, compact = false }: { grade: Grade; lang: Lang; compact?: boolean }) {
  const info = GRADE_INFO[grade];
  return (
    <span className={`grade-badge grade-badge-${grade}`} title={info.meaning[lang]}>
      {compact ? info.short : `${info.short} · ${info.label[lang]}`}
    </span>
  );
}
