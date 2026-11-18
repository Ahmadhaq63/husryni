import type { ItemTemplate } from "../checklist";
import type { Lang } from "../types";
import type { AiFinding, FixCheck, ItemAnalysis, SummaryOutput } from "./schema";

/**
 * Demo analyser used when no Claude credentials are configured.
 * Produces plausible, clearly fake findings so the full flow can be tried
 * end to end. The UI labels every mock result as a demo.
 */

type MockFinding = Omit<AiFinding, "title" | "description" | "recommended_action" | "photo_numbers"> & {
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  action: Record<Lang, string>;
};

const SAMPLES: Record<string, MockFinding> = {
  windows_int: {
    title: { is: "Móða milli glerja", en: "Fogging between panes" },
    description: {
      is: "Móða sést milli glerja í einum glugga sem bendir til að einangrunargler sé farið að leka.",
      en: "Fogging between the panes of one window suggests the sealed glass unit has failed.",
    },
    action: { is: "Skipta um glerið í viðkomandi glugga.", en: "Replace the glass unit in that window." },
    grade: "TG2",
    confidence: "high",
    follow_up: "none",
    urgency: "within_1y",
    cost_key: "window_glass_unit",
  },
  bathroom: {
    title: { is: "Sprungnar fúgur við sturtu", en: "Cracked grout at shower" },
    description: {
      is: "Sprungur í fúgum og losnað kítti í horni sturtu. Getur hleypt vatni á bak við flísar.",
      en: "Cracked grout and detached sealant in the shower corner. May let water behind the tiles.",
    },
    action: {
      is: "Endurfúga og kítta. Láta rakamæla vegg á bak við sturtu.",
      en: "Regrout and reseal. Have the wall behind the shower moisture-tested.",
    },
    grade: "TG2",
    confidence: "medium",
    follow_up: "moisture_measurement",
    urgency: "within_1y",
    cost_key: "wetroom_reseal",
  },
  walls_ceilings: {
    title: { is: "Rakablettur í lofti", en: "Water stain on ceiling" },
    description: {
      is: "Brúnleitur hringlaga blettur í lofti sem getur bent til leka að ofan.",
      en: "A brownish ring-shaped stain on the ceiling that may indicate a leak from above.",
    },
    action: {
      is: "Finna upptök (þak eða votrými að ofan) og rakamæla.",
      en: "Find the source (roof or wet room above) and take moisture readings.",
    },
    grade: "TG2",
    confidence: "medium",
    follow_up: "moisture_measurement",
    urgency: "within_1y",
    cost_key: "interior_repaint",
  },
  electrical_panel: {
    title: { is: "Tafla án lekaliða", en: "Panel without RCD" },
    description: {
      is: "Ekki sést lekaliði í töflunni og öryggi virðast vera af eldri gerð.",
      en: "No RCD is visible in the panel and the fuses appear to be an older type.",
    },
    action: { is: "Fá rafvirkja til að meta og setja lekaliða.", en: "Have an electrician assess it and install an RCD." },
    grade: "TG2",
    confidence: "medium",
    follow_up: "electrician",
    urgency: "within_1y",
    cost_key: "electrical_panel_upgrade",
  },
  facade: {
    title: { is: "Netsprungur í útvegg", en: "Map cracking on exterior wall" },
    description: {
      is: "Fínar netsprungur sjást á útvegg. Mynstrið getur bent til alkalívirkni eða frostskemmda.",
      en: "Fine map-pattern cracks are visible on the wall. The pattern may indicate alkali–silica reaction or frost damage.",
    },
    action: { is: "Láta sérfræðing meta steypuna.", en: "Have a specialist assess the concrete." },
    grade: "TG2",
    confidence: "low",
    follow_up: "structural_engineer",
    urgency: "within_5y",
    cost_key: "facade_crack_repair",
  },
  basement_storage: {
    title: { is: "Saltútfellingar neðst á vegg", en: "Efflorescence at wall base" },
    description: {
      is: "Hvítar útfellingar og flögnun neðst á vegg benda til raka að utan.",
      en: "White deposits and peeling at the base of the wall indicate moisture from outside.",
    },
    action: { is: "Rakamæla og kanna drenlögn.", en: "Take moisture readings and check the drainage." },
    grade: "TG2",
    confidence: "medium",
    follow_up: "moisture_measurement",
    urgency: "within_1y",
    cost_key: "drainage_replace",
  },
  roof: {
    title: { is: "Ryð á bárujárni", en: "Rust on corrugated iron" },
    description: {
      is: "Yfirborðsryð og flögnuð málning á hluta þaksins.",
      en: "Surface rust and flaking paint on part of the roof.",
    },
    action: { is: "Ryðhreinsa og mála þakið á næstu árum.", en: "Remove rust and repaint the roof within a few years." },
    grade: "TG1",
    confidence: "medium",
    follow_up: "none",
    urgency: "within_5y",
    cost_key: "roof_repaint",
  },
};

const OK_FINDING: MockFinding = {
  title: { is: "Ekkert athugavert sjáanlegt", en: "Nothing notable visible" },
  description: {
    is: "Ekkert athugavert sést á myndunum miðað við aldur eignarinnar.",
    en: "Nothing notable is visible in the photos given the property's age.",
  },
  action: { is: "Venjulegt viðhald.", en: "Routine maintenance." },
  grade: "TG0",
  confidence: "medium",
  follow_up: "none",
  urgency: "monitor",
  cost_key: "none",
};

export function mockAnalyzeItem(template: ItemTemplate, photoCount: number, lang: Lang): ItemAnalysis {
  const sample = SAMPLES[template.key] ?? OK_FINDING;
  const tooFew = photoCount < Math.max(1, template.minPhotos);
  return {
    photos_sufficient: !tooFew,
    retake_requests: tooFew
      ? [
          {
            photo_number: null,
            reason:
              lang === "is"
                ? `Bættu við mynd svo að minnsta kosti ${template.minPhotos} myndir sýni þennan lið.`
                : `Add a photo so at least ${template.minPhotos} photos show this item.`,
          },
        ]
      : [],
    privacy_flags: [],
    findings: [
      {
        title: sample.title[lang],
        description: sample.description[lang],
        grade: sample.grade,
        confidence: sample.confidence,
        photo_numbers: [1],
        recommended_action: sample.action[lang],
        follow_up: sample.follow_up,
        urgency: sample.urgency,
        cost_key: sample.cost_key,
      },
    ],
    item_summary:
      lang === "is"
        ? `[Sýnigreining] ${sample.grade === "TG0" ? "Ástand virðist eðlilegt." : "Eitt atriði þarfnast athygli."}`
        : `[Demo analysis] ${sample.grade === "TG0" ? "Condition appears normal." : "One issue needs attention."}`,
  };
}

export function mockSummarize(lang: Lang, counts: { tg2: number; tg3: number; total: number }): SummaryOutput {
  if (lang === "is") {
    return {
      overall: `[Sýnisamantekt] Skráð voru ${counts.total} atriði, þar af ${counts.tg3} alvarleg og ${counts.tg2} veruleg frávik. Skýrslan byggir eingöngu á myndum; leyndir gallar verða ekki útilokaðir.`,
      key_risks: counts.tg2 + counts.tg3 > 0 ? ["Rakatengd atriði sem þarf að staðfesta með mælingum."] : [],
      advice: "Láta fagaðila staðfesta veruleg frávik áður en gengið er frá kaupum eða sölu.",
    };
  }
  return {
    overall: `[Demo summary] ${counts.total} items were recorded: ${counts.tg3} serious and ${counts.tg2} significant deviations. The report is based on photos only; hidden defects cannot be ruled out.`,
    key_risks: counts.tg2 + counts.tg3 > 0 ? ["Moisture-related issues that should be confirmed with measurements."] : [],
    advice: "Have a professional confirm significant deviations before completing the sale or purchase.",
  };
}

export function mockVerifyFix(lang: Lang, afterCount: number): FixCheck {
  const is = lang === "is";
  return {
    verdict: afterCount >= 2 ? "fixed" : "cannot_tell",
    same_location: afterCount >= 2 ? "yes" : "unsure",
    explanation: is
      ? `[Sýnigreining] ${afterCount >= 2 ? "Ummerki gallans sjást ekki lengur á myndum eftir lagfæringu." : "Ein mynd dugar ekki til að staðfesta að sami staður sé sýndur."}`
      : `[Demo analysis] ${afterCount >= 2 ? "The defect is no longer visible in the after photos." : "One photo is not enough to confirm the same spot is shown."}`,
    remaining_issues: [],
    retake_requests:
      afterCount >= 2
        ? []
        : [{ photo_number: null, reason: is ? "Bættu við víðri mynd sem sýnir staðsetninguna." : "Add a wide photo that shows the location." }],
  };
}
