import type { L10n } from "./types";

/**
 * Repair cost catalogue used to turn findings into ISK ranges.
 *
 * ⚠️  PLACEHOLDER FIGURES. These are rough order-of-magnitude guesses written
 * for the prototype, NOT sourced prices. Before showing costs to real
 * customers, replace them with ranges from Icelandic contractors / a cost
 * database and set COST_TABLE_VERIFIED to true.
 *
 * The AI only picks a key; it never invents numbers. That keeps costs
 * consistent, auditable and easy to update in one place.
 */
export const COST_TABLE_VERIFIED = false;

export interface CostEntry {
  label: L10n;
  /** ISK incl. VAT, typical job for one dwelling */
  minIsk: number;
  maxIsk: number;
}

export const COST_CATALOG = {
  roof_repaint: { label: { is: "Málun þaks", en: "Repaint roof" }, minIsk: 800_000, maxIsk: 2_000_000 },
  roof_fastener_repair: { label: { is: "Viðgerð á festingum/þakköntum", en: "Roof fastener / flashing repair" }, minIsk: 150_000, maxIsk: 600_000 },
  roof_replace: { label: { is: "Endurnýjun þakklæðningar", en: "Replace roof covering" }, minIsk: 4_000_000, maxIsk: 9_000_000 },
  flat_roof_membrane: { label: { is: "Ný þakdúkur á flatt þak", en: "New flat-roof membrane" }, minIsk: 2_000_000, maxIsk: 6_000_000 },
  gutter_replace: { label: { is: "Nýjar þakrennur og niðurföll", en: "Replace gutters and downpipes" }, minIsk: 400_000, maxIsk: 1_200_000 },
  facade_crack_repair: { label: { is: "Sprunguviðgerðir á útveggjum", en: "Facade crack repair" }, minIsk: 300_000, maxIsk: 1_500_000 },
  facade_repair_paint: { label: { is: "Steypuviðgerðir og málun útveggja", en: "Concrete repair and repaint facade" }, minIsk: 1_500_000, maxIsk: 5_000_000 },
  timber_cladding_repair: { label: { is: "Viðgerð á timburklæðningu", en: "Timber cladding repair" }, minIsk: 300_000, maxIsk: 1_500_000 },
  window_reseal_paint: { label: { is: "Kíttun og málun glugga", en: "Reseal and paint windows" }, minIsk: 100_000, maxIsk: 400_000 },
  window_glass_unit: { label: { is: "Nýtt gler (ein rúða)", en: "Replace sealed glass unit (one)" }, minIsk: 80_000, maxIsk: 200_000 },
  window_replace: { label: { is: "Nýr gluggi (einn, ísettur)", en: "Replace window (one, installed)" }, minIsk: 250_000, maxIsk: 600_000 },
  door_replace: { label: { is: "Ný útidyrahurð", en: "Replace exterior door" }, minIsk: 300_000, maxIsk: 700_000 },
  balcony_repair: { label: { is: "Svalaviðgerð og þétting", en: "Balcony concrete repair and waterproofing" }, minIsk: 500_000, maxIsk: 2_000_000 },
  railing_fix: { label: { is: "Viðgerð á handriði", en: "Railing repair" }, minIsk: 50_000, maxIsk: 300_000 },
  drainage_replace: { label: { is: "Ný drenlögn", en: "Replace foundation drainage" }, minIsk: 2_000_000, maxIsk: 5_000_000 },
  regrade_ground: { label: { is: "Lagfæring á halla lóðar", en: "Regrade ground away from house" }, minIsk: 200_000, maxIsk: 800_000 },
  wetroom_reseal: { label: { is: "Endurfúgun og kíttun votrýmis", en: "Regrout and reseal wet room" }, minIsk: 50_000, maxIsk: 250_000 },
  bathroom_renovation: { label: { is: "Endurnýjun baðherbergis", en: "Bathroom renovation" }, minIsk: 3_000_000, maxIsk: 7_000_000 },
  kitchen_leak_repair: { label: { is: "Lekaviðgerð og nýr skápabotn", en: "Fix leak and replace cabinet base" }, minIsk: 50_000, maxIsk: 250_000 },
  floor_replace: { label: { is: "Nýtt gólfefni (eitt rými)", en: "Replace flooring (one room)" }, minIsk: 300_000, maxIsk: 900_000 },
  mold_remediation_small: { label: { is: "Myglueyðing, afmarkað svæði", en: "Mould remediation, limited area" }, minIsk: 150_000, maxIsk: 600_000 },
  mold_remediation_large: { label: { is: "Myglueyðing, umfangsmikil", en: "Mould remediation, extensive" }, minIsk: 1_500_000, maxIsk: 6_000_000 },
  interior_repaint: { label: { is: "Viðgerð og málun innanhúss", en: "Interior repair and repaint" }, minIsk: 100_000, maxIsk: 500_000 },
  electrical_panel_upgrade: { label: { is: "Ný rafmagnstafla með lekaliða", en: "New electrical panel with RCD" }, minIsk: 300_000, maxIsk: 900_000 },
  rewiring: { label: { is: "Endurnýjun raflagna", en: "Rewire dwelling" }, minIsk: 1_500_000, maxIsk: 4_000_000 },
  heating_manifold_renew: { label: { is: "Endurnýjun hitaveitugrindar", en: "Renew heating manifold" }, minIsk: 300_000, maxIsk: 800_000 },
  radiator_valve_replace: { label: { is: "Nýir ofnlokar/ofn", en: "Replace radiator valves/radiator" }, minIsk: 50_000, maxIsk: 250_000 },
  water_pipes_replace: { label: { is: "Endurnýjun neysluvatnslagna", en: "Replace water supply pipes" }, minIsk: 1_500_000, maxIsk: 4_000_000 },
  sewer_relining: { label: { is: "Fóðrun skólplagna", en: "Sewer pipe relining" }, minIsk: 1_500_000, maxIsk: 4_000_000 },
  sewer_replace: { label: { is: "Endurnýjun skólplagna", en: "Replace sewer pipes" }, minIsk: 3_000_000, maxIsk: 8_000_000 },
  ventilation_fix: { label: { is: "Viðgerð/uppsetning á loftræsingu", en: "Fix or install extract ventilation" }, minIsk: 50_000, maxIsk: 300_000 },
  fire_safety_basic: { label: { is: "Reykskynjarar og slökkvibúnaður", en: "Smoke detectors and extinguisher" }, minIsk: 10_000, maxIsk: 50_000 },
} satisfies Record<string, CostEntry>;

export type CostKey = keyof typeof COST_CATALOG;
export const COST_KEYS = Object.keys(COST_CATALOG) as CostKey[];

export function getCost(key: string): CostEntry | undefined {
  return (COST_CATALOG as Record<string, CostEntry>)[key];
}

export function formatIsk(n: number, lang: "is" | "en"): string {
  const s = new Intl.NumberFormat(lang === "is" ? "is-IS" : "en-GB", { maximumFractionDigits: 0 }).format(n);
  return `${s} kr.`;
}
