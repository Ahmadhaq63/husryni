import type { L10n } from "./types";

export interface DrawingArchive {
  name: L10n;
  url: string;
}

/**
 * Online archives of approved drawings, by postcode (sources in docs/business-plan.md / research 2026-11-17).
 * Anything else: contact the municipality's building official.
 */
const ARCHIVES: { ranges: [number, number][]; archive: DrawingArchive }[] = [
  { ranges: [[101, 162]], archive: { name: { is: "Teikningasafn Reykjavíkurborgar", en: "Reykjavík blueprint archive" }, url: "https://skjalasafn.reykjavik.is/fotoweb/" } },
  { ranges: [[200, 203]], archive: { name: { is: "Teikningavefur Kópavogs", en: "Kópavogur drawings map" }, url: "https://map.is/kopavogur/?teikningar" } },
  { ranges: [[220, 222]], archive: { name: { is: "Granni, bæjarvefsjá Hafnarfjarðar", en: "Hafnarfjörður Granni map" }, url: "https://hafnarfjordur.granni.is" } },
  { ranges: [[210, 212], [225, 225]], archive: { name: { is: "Kortavefur Garðabæjar", en: "Garðabær map portal" }, url: "https://www.gardabaer.is/kortavefur" } },
  { ranges: [[270, 276]], archive: { name: { is: "Kortavefur Mosfellsbæjar", en: "Mosfellsbær map portal" }, url: "https://map.is/moso" } },
  { ranges: [[600, 603]], archive: { name: { is: "Kortavefur Akureyrar", en: "Akureyri map portal" }, url: "https://map.is/akureyri" } },
];

export function drawingArchive(postalCode: string): DrawingArchive | null {
  const n = Number(postalCode);
  if (!Number.isInteger(n)) return null;
  return ARCHIVES.find((a) => a.ranges.some(([lo, hi]) => n >= lo && n <= hi))?.archive ?? null;
}
