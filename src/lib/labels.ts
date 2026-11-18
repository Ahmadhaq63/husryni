import type {
  ConstructionStage,
  Confidence,
  ConstructionType,
  FollowUp,
  Grade,
  HeatingType,
  InspectionStatus,
  L10n,
  Lang,
  PropertyType,
  Purpose,
  Tier,
  Urgency,
} from "./types";

export const t10 = (v: L10n, lang: Lang) => v[lang];

export interface GradeInfo {
  short: string;
  label: L10n;
  meaning: L10n;
  /** Bootstrap contextual colour */
  color: "success" | "info" | "warning" | "danger" | "secondary";
  severity: number;
}

export const GRADE_INFO: Record<Grade, GradeInfo> = {
  TG0: {
    short: "0",
    label: { is: "Í góðu lagi", en: "Good condition" },
    meaning: {
      is: "Engin frávik sjáanleg. Byggingarhluti virðist í eðlilegu ástandi miðað við aldur.",
      en: "No visible deviation. Component appears in normal condition for its age.",
    },
    color: "success",
    severity: 0,
  },
  TG1: {
    short: "1",
    label: { is: "Minniháttar frávik", en: "Minor deviation" },
    meaning: {
      is: "Eðlilegt slit eða minniháttar atriði. Þarfnast venjulegs viðhalds.",
      en: "Normal wear or minor issue. Needs routine maintenance.",
    },
    color: "info",
    severity: 1,
  },
  TG2: {
    short: "2",
    label: { is: "Verulegt frávik", en: "Significant deviation" },
    meaning: {
      is: "Greinileg merki um skemmdir eða skerta virkni. Bregðast þarf við eða rannsaka nánar.",
      en: "Clear signs of damage or reduced function. Needs action or further investigation.",
    },
    color: "warning",
    severity: 2,
  },
  TG3: {
    short: "3",
    label: { is: "Alvarlegt frávik", en: "Serious deviation" },
    meaning: {
      is: "Alvarleg skemmd, bilun eða hætta. Bregðast þarf við strax.",
      en: "Serious damage, failure or hazard. Immediate action needed.",
    },
    color: "danger",
    severity: 3,
  },
  TGIU: {
    short: "?",
    label: { is: "Ekki metið", en: "Not assessed" },
    meaning: {
      is: "Ekki hægt að meta út frá gögnum (t.d. óaðgengilegt eða myndir ófullnægjandi).",
      en: "Cannot be assessed from the material (e.g. not accessible or photos insufficient).",
    },
    color: "secondary",
    severity: -1,
  },
};

export const FOLLOW_UP_LABEL: Record<FollowUp, L10n> = {
  none: { is: "Engin frekari skoðun", en: "No further check" },
  moisture_measurement: { is: "Rakamæling", en: "Moisture measurement" },
  mold_sampling: { is: "Myglusýnataka", en: "Mould sampling" },
  sewer_camera: { is: "Myndun skólplagna", en: "Sewer camera inspection" },
  electrician: { is: "Úttekt rafvirkja", en: "Electrician check" },
  plumber: { is: "Úttekt pípulagningamanns", en: "Plumber check" },
  roofer: { is: "Úttekt á þaki", en: "Roofer check" },
  structural_engineer: { is: "Mat verkfræðings", en: "Structural engineer" },
  ventilation_specialist: { is: "Úttekt á loftræsingu", en: "Ventilation check" },
};

export const URGENCY_LABEL: Record<Urgency, L10n> = {
  immediate: { is: "Strax", en: "Immediately" },
  within_1y: { is: "Innan árs", en: "Within a year" },
  within_5y: { is: "Innan 5 ára", en: "Within 5 years" },
  monitor: { is: "Fylgjast með", en: "Monitor" },
};

export const CONFIDENCE_LABEL: Record<Confidence, L10n> = {
  low: { is: "Lítil vissa", en: "Low confidence" },
  medium: { is: "Miðlungs vissa", en: "Medium confidence" },
  high: { is: "Mikil vissa", en: "High confidence" },
};

export const PROPERTY_TYPE_LABEL: Record<PropertyType, L10n> = {
  fjolbyli: { is: "Íbúð í fjölbýli", en: "Apartment (multi-unit)" },
  einbyli: { is: "Einbýlishús", en: "Detached house" },
  radhus: { is: "Raðhús", en: "Terraced house" },
  parhus: { is: "Parhús", en: "Semi-detached house" },
  sumarhus: { is: "Sumarhús", en: "Summer house" },
};

export const CONSTRUCTION_LABEL: Record<ConstructionType, L10n> = {
  steypa: { is: "Steinsteypt", en: "Concrete" },
  timbur: { is: "Timbur", en: "Timber" },
  stal: { is: "Stálgrind", en: "Steel frame" },
  hladid: { is: "Hlaðið (t.d. holsteinn)", en: "Masonry (e.g. hollow block)" },
  annad: { is: "Annað / óvíst", en: "Other / unknown" },
};

export const HEATING_LABEL: Record<HeatingType, L10n> = {
  hitaveita: { is: "Hitaveita", en: "Geothermal district heating" },
  rafmagn: { is: "Rafmagnskynding", en: "Electric heating" },
  varmadaela: { is: "Varmadæla", en: "Heat pump" },
  annad: { is: "Annað", en: "Other" },
};

export const PURPOSE_LABEL: Record<Purpose, L10n> = {
  seller: { is: "Ég er að selja", en: "I am selling" },
  buyer: { is: "Ég er að kaupa", en: "I am buying" },
  owner: { is: "Ég á eignina og vil vita ástandið", en: "I own it and want to know its condition" },
};

export const TIER_LABEL: Record<Tier, L10n> = {
  basic: { is: "Grunnskýrsla (gervigreind)", en: "Basic report (AI)" },
  verified: { is: "Staðfest skýrsla (skoðunarmaður)", en: "Verified report (inspector)" },
};

export const STATUS_LABEL: Record<InspectionStatus, L10n> = {
  capturing: { is: "Myndataka í gangi", en: "Capturing photos" },
  in_review: { is: "Í yfirferð skoðunarmanns", en: "With inspector for review" },
  ai_report: { is: "Gervigreindarskýrsla tilbúin", en: "AI report ready" },
  verified: { is: "Staðfest af skoðunarmanni", en: "Verified by inspector" },
};

export const STAGE_LABEL: Record<ConstructionStage, L10n> = {
  B4: { is: "B4 – fullgert", en: "B4 – completed" },
  B3: { is: "B3 – tilbúið til innréttingar", en: "B3 – ready for interior fit-out" },
  B1_B2: { is: "B1–B2 – í byggingu (leyfi eða fokhelt)", en: "B1–B2 – under construction (permit or weathertight)" },
  unknown: { is: "Veit ekki", en: "Don't know" },
};

/** Fixed retake advice per photo-check issue code (see PhotoCheckSchema). */
export const PHOTO_ISSUE_ADVICE: Record<string, L10n> = {
  too_dark: { is: "Of dimm — kveiktu ljós eða notaðu flass.", en: "Too dark — turn on a light or use the flash." },
  blurry: { is: "Óskýr — haltu símanum kyrrum og bíddu eftir fókus.", en: "Blurry — hold the phone steady and let it focus." },
  wrong_subject: { is: "Sýnir ekki réttan hlut — lestu leiðbeiningarnar fyrir þennan lið.", en: "Doesn't show the right thing — read this item's instructions." },
  too_far: { is: "Of langt frá — farðu nær svo smáatriði sjáist.", en: "Too far away — move closer so details are visible." },
  too_close: { is: "Of nálægt — farðu aðeins fjær svo samhengið sjáist.", en: "Too close — step back so the surroundings are visible." },
  obstructed: { is: "Eitthvað skyggir á — færðu hluti frá eða opnaðu hurð eða skáp.", en: "Something is in the way — move things aside or open the door or cabinet." },
  personal_data: { is: "Fólk eða persónuupplýsingar sjást — taktu myndina aftur án þeirra.", en: "People or personal information are visible — retake without them." },
  other: { is: "Taktu myndina aftur svo liðurinn sjáist vel.", en: "Retake the photo so the item is clearly visible." },
};

/**
 * What each registered construction stage means for a buyer (shown in the report).
 * HMS: B1 permit, B2 weathertight (fokhelt), B3 ready for fit-out, B4 completed. Reykjavík records
 * B3 at the safety inspection and B4 at the final inspection, but HMS can date B4 from an ordinary
 * inspection, so B4 alone does not prove a final-inspection certificate exists.
 */
export const STAGE_NOTE: Record<ConstructionStage, { tone: "success" | "warning" | "danger" | "secondary"; text: L10n }> = {
  B4: {
    tone: "success",
    text: {
      is: "Skráð sem fullgert. Það sannar þó ekki eitt og sér að lokaúttekt hafi farið fram — biddu um lokaúttektarvottorð.",
      en: "Registered as completed. On its own this does not prove a final inspection took place — ask for the final-inspection certificate.",
    },
  },
  B3: {
    tone: "warning",
    text: {
      is: "Skráð sem tilbúið til innréttingar; í Reykjavík er B3 skráð við öryggisúttekt. Ef búið er í eigninni bendir það til að lokaúttekt hafi ekki farið fram, en hún á að fara fram innan 3 ára frá því að mannvirkið var tekið í notkun (byggingarreglugerð nr. 112/2012, gr. 3.9.1). Biddu um öryggisúttektarvottorð og kannaðu stöðu lokaúttektar.",
      en: "Registered as ready for interior fit-out; in Reykjavík B3 is recorded at the safety inspection. If the property is lived in, this suggests no final inspection has taken place, although it is due within 3 years of the building being taken into use (building regulation 112/2012, art. 3.9.1). Ask for the safety-inspection certificate and check the status of the final inspection.",
    },
  },
  B1_B2: {
    tone: "danger",
    text: {
      is: "Skráð í byggingu (B1 = byggingarleyfi, B2 = fokhelt). Sumir lánveitendur lána ekki út á eignir á þessu byggingarstigi.",
      en: "Registered as under construction (B1 = building permit, B2 = weathertight). Some lenders will not lend against property at this stage.",
    },
  },
  unknown: {
    tone: "secondary",
    text: {
      is: "Byggingarstig var ekki gefið upp. Fasteignasali eða seljandi getur gefið það upp (fasteignaskrá HMS). Biddu einnig um lokaúttektarvottorð.",
      en: "The construction stage was not provided. The realtor or seller can provide it (HMS property register). Also ask for the final-inspection certificate.",
    },
  },
};
