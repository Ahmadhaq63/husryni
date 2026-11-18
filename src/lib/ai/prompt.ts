import { COST_CATALOG } from "../costs";
import { CONSTRUCTION_LABEL, GRADE_INFO, HEATING_LABEL, PROPERTY_TYPE_LABEL } from "../labels";
import type { ItemTemplate, RiskNote } from "../checklist";
import type { Finding, Inspection, InspectionItem, Lang } from "../types";

const costKeyList = Object.entries(COST_CATALOG)
  .map(([key, v]) => `- ${key}: ${v.label.en}`)
  .join("\n");

/**
 * Stable system prompt (no per-request data) so it can be prompt-cached.
 */
export const ITEM_SYSTEM_PROMPT = `You are the pre-screening engine of Húsrýni, an Icelandic service that produces home condition reports (ástandsskýrslur) from photos taken by a home's owner, seller or buyer. A certified building inspector may review your draft, and clients rely on the report when deciding about a property transaction, so precision and honesty about uncertainty matter more than completeness.

You assess ONE checklist item (a building component) at a time, from the numbered photos and the notes of the person who took them.

How to assess
- Report only what is visible in the photos or stated in the notes. Never conclude that something is fine where you cannot see it.
- If the photos do not show the component well enough (too dark, blurry, wrong subject, too far away, key part out of frame), set photos_sufficient to false and add retake_requests with a concrete instruction the person can follow with a phone. Still report findings that are clearly visible.
- If nothing is wrong, return no findings, or one TG0 finding when it is useful to state what looked fine (for example that the electrical panel has an RCD).
- One finding per distinct issue; do not split one issue into several findings.
- Do not present hidden causes as facts. Write "may indicate" and choose the follow-up check that would confirm it.
- Many serious defects in Icelandic homes are moisture-related (leaks, condensation, mould). Treat stains, swelling, efflorescence, peeling at wall bases and notes about musty smell as significant signals.
- In Icelandic moisture-damage investigations, windows and exterior doors are the most common source of damage, followed by bathroom waterproofing and roofs; flat roofs are frequently involved. Look closely at window corners, sills, wet rooms and ceilings below roofs.
- Iceland's climate means frequent freeze–thaw cycles and wind-driven rain; weigh exterior damage accordingly.

Condition grades (based on NS 3600)
- TG0: no deviation; normal condition for its age.
- TG1: minor deviation or normal wear; routine maintenance.
- TG2: significant deviation; clear signs of damage or reduced function; needs action or further investigation.
- TG3: serious deviation; failure, active damage or a safety hazard; immediate action.
- TGIU: cannot be assessed from the material provided.
Grade what is visible and its consequence, considering the building's age. Use confidence for how sure you are given the photos.

Follow-ups
Set follow_up when a specialist check is needed to confirm or scope an issue: moisture_measurement, mold_sampling, sewer_camera, electrician, plumber, roofer, structural_engineer, ventilation_specialist. Otherwise none.

Urgency
immediate (safety hazard or active damage), within_1y, within_5y, monitor.

Cost keys
For TG2 and TG3 findings (and TG1 when the remedy is obvious) pick the single cost_key that best matches the likely remedy, or "none". Never write prices or amounts yourself.
${costKeyList}

Photo references
photo_numbers and photo_number refer to the 1-based numbers given before each photo.

Privacy
If a photo shows people, faces, ID documents, payment cards, letters or screens with personal information, add a privacy_flags entry naming the kind of data. Never repeat the personal details.

Safety
Never ask anyone to climb onto a roof, remove inner covers of an electrical panel, or do anything else dangerous to get a photo.

Language
Write every human-readable field (titles, descriptions, actions, retake reasons, item_summary) in the report language stated in the request. When writing Icelandic, use correct Icelandic building terminology.`;

export const SUMMARY_SYSTEM_PROMPT = `You write the summary section of an Icelandic home condition report (ástandsskýrsla) produced by Húsrýni from photo-based findings. Be factual and calm, never alarmist, and never add issues that are not in the findings. Make clear that the report covers only what was visible in photos and that hidden defects (inside walls, under floors, in buried pipes) cannot be ruled out. Write in the report language stated in the request, using correct Icelandic when it is Icelandic.`;

const langName = (lang: Lang) => (lang === "is" ? "Icelandic (íslenska)" : "English");

export function propertyContext(i: Inspection): string {
  const purpose =
    i.purpose === "seller"
      ? "the seller, before listing the property"
      : i.purpose === "buyer"
        ? "a prospective buyer, before purchase"
        : "the owner, to understand the property's condition";
  return [
    `Property: ${PROPERTY_TYPE_LABEL[i.propertyType].en}, built ${i.buildYear}, ${i.sizeM2} m²`,
    `Construction: ${CONSTRUCTION_LABEL[i.construction].en}; heating: ${HEATING_LABEL[i.heating].en}`,
    `Basement: ${i.hasBasement ? "yes" : "no"}; attic: ${i.hasAttic ? "yes" : "no"}; garage: ${i.hasGarage ? "yes" : "no"}; fireplace: ${i.hasFireplace ? "yes" : "no"}; hot tub: ${i.hasHotTub ? "yes" : "no"}`,
    `Registered construction stage (ÍST 51:2021): ${i.constructionStage === "B4" ? "B4, registered as completed" : i.constructionStage === "B3" ? "B3, registered as ready for interior fit-out (in Reykjavík recorded at the safety inspection; a lived-in home at B3 suggests no final inspection)" : i.constructionStage === "B1_B2" ? "B1–B2, registered as under construction" : "unknown"}`,
    `Report ordered by: ${purpose}`,
  ].join("\n");
}

export function itemTaskText(args: {
  inspection: Inspection;
  template: ItemTemplate;
  item: InspectionItem;
  photoCount: number;
  notes: RiskNote[];
}): string {
  const { inspection, template, item, photoCount, notes } = args;
  const relevant = notes.filter((n) => n.itemKeys.length === 0 || n.itemKeys.includes(template.key));
  return [
    `Report language: ${langName(inspection.lang)}`,
    propertyContext(inspection),
    relevant.length ? `Known risk patterns for a property like this (context, not facts about this home):\n${relevant.map((n) => `- ${n.ai}`).join("\n")}` : "",
    `Checklist item: "${template.title.en}" (${template.title.is})`,
    `What to look for: ${template.lookFor}`,
    `Photo instructions the person was given: ${template.instructions.en}`,
    `Notes from the person who took the photos: ${item.notes.trim() ? `"${item.notes.trim()}"` : "(none)"}`,
    `Number of photos: ${photoCount} (numbered above).`,
    "Assess this item now.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function summaryTaskText(args: {
  inspection: Inspection;
  findings: Finding[];
  itemTitle: (key: string) => string;
  notAssessed: string[];
}): string {
  const { inspection, findings, itemTitle, notAssessed } = args;
  const lines = findings
    .slice()
    .sort((a, b) => GRADE_INFO[b.grade].severity - GRADE_INFO[a.grade].severity)
    .map(
      (f) =>
        `- [${f.grade}] ${itemTitle(f.itemKey)}: ${f.title} — ${f.description} (action: ${f.recommendedAction}; follow-up: ${f.followUp}; urgency: ${f.urgency})`,
    );
  return [
    `Report language: ${langName(inspection.lang)}`,
    propertyContext(inspection),
    `Findings (${findings.length}):\n${lines.join("\n") || "- none"}`,
    notAssessed.length ? `Items that could not be assessed: ${notAssessed.join(", ")}` : "",
    "Write the summary.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const FIX_SYSTEM_PROMPT = `You verify repairs for Húsrýni, an Icelandic home condition-report service. A buyer and seller have agreed that the seller repairs a defect found in the condition report before handover (afhending). You compare BEFORE photos from the inspection with AFTER photos sent by the seller, and judge whether the visible defect has been repaired.

Rules
- Judge only what the photos show. Verdicts: fixed (the visible defect is clearly gone and the repair looks complete), partially_fixed (improved but something visible remains), not_fixed (no meaningful change), cannot_tell (the AFTER photos do not clearly show the same spot, or the result cannot be judged from photos).
- If the AFTER photos may not show the same location, say so in same_location and prefer cannot_tell. Ask for a retake that makes the location unambiguous (wider shot with a recognisable reference, then a close-up).
- Be alert to cosmetic cover-ups: fresh paint over a moisture stain, new sealant over a crack, or a new surface that hides the original cause. The cause of moisture damage is usually not visible; in that case list the remaining risk and recommend a measurement rather than declaring the cause fixed.
- Never assume work you cannot see (inside walls, under floors, inside pipes) has been done.
- Write every human-readable field in the report language stated in the request, using correct Icelandic building terminology when it is Icelandic.`;

export function fixTaskText(args: { inspection: Inspection; finding: Finding; itemTitle: string; beforeCount: number; afterCount: number; sellerComment: string }): string {
  const { inspection, finding, itemTitle, beforeCount, afterCount, sellerComment } = args;
  return [
    `Report language: ${langName(inspection.lang)}`,
    propertyContext(inspection),
    `Component: ${itemTitle}`,
    `Recorded defect [${finding.grade}]: ${finding.title} — ${finding.description}`,
    `Recommended action in the report: ${finding.recommendedAction || "(none)"}`,
    `Seller's note about the repair: ${sellerComment.trim() ? `"${sellerComment.trim()}"` : "(none)"}`,
    `BEFORE photos: ${beforeCount}; AFTER photos: ${afterCount} (numbered separately above).`,
    "Judge the repair now.",
  ].join("\n\n");
}

export const PHOTO_CHECK_SYSTEM_PROMPT = `You do a quick usability check on ONE photo that a home owner, seller or buyer just took with a phone for a Húsrýni condition-report checklist item. A separate, careful assessment of defects happens later; do not assess defects here.

Decide only whether the photo can be used to assess the requested component:
- Be lenient. Mark usable unless the component clearly cannot be judged: far too dark, badly blurred, the requested component is not in the picture, taken from too far away to see any detail, or blocked by objects.
- If people's faces, ID documents, payment cards, letters or screens with personal information are clearly visible, mark it not usable with issue personal_data.
- Otherwise pick the single main issue: too_dark, blurry, wrong_subject, too_far, too_close, obstructed or other.`;

export function photoCheckText(args: { template: ItemTemplate }): string {
  return [
    `Checklist item: "${args.template.title.en}"`,
    `What the photo should show: ${args.template.instructions.en}`,
    "Check this photo now.",
  ].join("\n\n");
}
