import type { Lang } from "@/lib/types";

/**
 * Same text as formatIsk() in src/lib/costs.ts produces on the server ("250.000 kr." / "250,000 kr."),
 * but without Intl. Client components use it so the browser renders exactly what the server did:
 * some browsers ship without Icelandic number data and fall back to "250,000", which breaks hydration.
 */
export function formatIskStable(n: number, lang: Lang): string {
  const digits = Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, lang === "is" ? "." : ",");
  return `${n < 0 ? "-" : ""}${digits} kr.`;
}
