import type { L10n } from "./types";

/** Draft price points for the prototype (ISK incl. VAT). See docs/business-plan.md for the reasoning. */
export interface PricePlan {
  key: "basic" | "verified" | "agency";
  name: L10n;
  price: L10n;
  /** The fixed fee in ISK incl. VAT (null when quoted). Printed on signed reports: it does not depend on the result. */
  amountIsk: number | null;
  per: L10n;
  features: L10n[];
  highlighted?: boolean;
}

export const PLANS: PricePlan[] = [
  {
    key: "basic",
    name: { is: "Grunnskýrsla", en: "Basic report" },
    price: { is: "19.900 kr.", en: "ISK 19,900" },
    amountIsk: 19_900,
    per: { is: "á eign", en: "per property" },
    features: [
      { is: "Gátlisti sniðinn að eigninni", en: "Checklist tailored to the property" },
      { is: "Gervigreind metur hvern lið (0–3)", en: "AI grades every item (0–3)" },
      { is: "Ráðlagðar sérfræðiskoðanir", en: "Recommended specialist checks" },
      { is: "Kostnaðarbil viðgerða", en: "Repair cost ranges" },
      { is: "Ekki staðfest af fagmanni", en: "Not verified by a professional" },
    ],
  },
  {
    key: "verified",
    name: { is: "Staðfest skýrsla", en: "Verified report" },
    price: { is: "49.900 kr.", en: "ISK 49,900" },
    amountIsk: 49_900,
    per: { is: "á eign", en: "per property" },
    highlighted: true,
    features: [
      { is: "Allt í grunnskýrslu", en: "Everything in Basic" },
      { is: "Skoðunarmaður fer yfir og undirritar", en: "Inspector reviews and signs" },
      { is: "Skýrsla innan 48 klst. frá því myndir berast", en: "Report within 48 hours of receiving photos" },
      { is: "Myndun lagna, rakamæling o.fl. bókuð aðeins ef þarf", en: "Sewer camera, moisture readings etc. booked only if needed" },
    ],
  },
  {
    key: "agency",
    name: { is: "Fasteignasölur", en: "Real estate agencies" },
    price: { is: "Tilboð", en: "Quote" },
    amountIsk: null,
    per: { is: "magnverð á skráningu", en: "volume price per listing" },
    features: [
      { is: "Staðfest skýrsla með hverri sölu", en: "A verified report with every listing" },
      { is: "Seljandi tekur myndirnar sjálfur", en: "The seller takes the photos" },
      { is: "Færri gallamál eftir afhendingu", en: "Fewer defect disputes after handover" },
      { is: "Tenging við söluskráningu (API)", en: "Listing integration (API)" },
    ],
  },
];

/** The fixed fee for a tier (null when it is quoted per agreement). */
export const feeForTier = (tier: "basic" | "verified") => PLANS.find((p) => p.key === tier)?.amountIsk ?? null;
