import { annualTotals } from "../annual";
import { dueDate, getAnswers, getFollowUps, listAnnualChecks, openFindings } from "../annualRepo";
import { getTemplate } from "../checklist";
import { formatIsk, getCost } from "../costs";
import { CONSTRUCTION_LABEL, FOLLOW_UP_LABEL, GRADE_INFO, HEATING_LABEL, PROPERTY_TYPE_LABEL, TIER_LABEL, URGENCY_LABEL } from "../labels";
import { LEGAL_REFERENCE } from "../negotiation";
import { listProblems } from "../ownerRepo";
import { PROBLEM_CATEGORY_LABEL } from "../ownerTools";
import { formatAddress } from "../postcodes";
import { getBundle } from "../repo";
import { activeFindings, buildReport } from "../report";
import { formatReading, MOISTURE_LEVEL_LABEL, moistureLevel, OVERALL_RULE, overallReasonText, SYSTEM_LABEL } from "../standard";
import type { Finding, Grade, Lang } from "../types";

/** What the demo assistant needs to answer without a model. */
export interface AssistantFacts {
  lang: Lang;
  address: string;
  overall: Grade;
  overallReason: string;
  serious: string[];
  significant: string[];
  costText: string | null;
  moisture: string[];
  dueText: string;
  openCount: number;
  notAssessed: string[];
}

/**
 * Everything the assistant may use about one property, as compact text (stable for a given report, so it is
 * prompt-cached across questions). Labels in English for the model, content in the report's language.
 */
export function assistantContext(rootId: string): { text: string; facts: AssistantFacts } | null {
  const bundle = getBundle(rootId);
  if (!bundle) return null;
  const i = bundle.inspection;
  const lang = i.lang;
  const r = buildReport(bundle);
  const title = (key: string) => getTemplate(key)?.title[lang] ?? key;
  const day = (iso: string) => new Intl.DateTimeFormat(lang === "is" ? "is-IS" : "en-GB", { dateStyle: "long", timeZone: "Atlantic/Reykjavik" }).format(new Date(iso));
  const overall = i.overallGrade ?? r.overall.grade;
  const overallReason = overallReasonText(r.overall, lang, title);
  const findings = activeFindings(bundle.findings).filter((f) => f.grade !== "TG0");
  const line = (f: Finding) => {
    const c = getCost(f.costKey);
    return [
      `- [${f.grade}] ${title(f.itemKey)}: ${f.title}. ${f.description}`,
      f.cause && `Cause: ${f.cause}`,
      f.consequence && `Consequence: ${f.consequence}`,
      f.recommendedAction && `Action: ${f.recommendedAction}`,
      `Urgency: ${URGENCY_LABEL[f.urgency].en}`,
      f.followUp !== "none" && `Further check: ${FOLLOW_UP_LABEL[f.followUp].en}`,
      c && `Estimate: ${formatIsk(c.minIsk, lang)}–${formatIsk(c.maxIsk, lang)}`,
    ]
      .filter(Boolean)
      .join(". ");
  };
  const skipped = bundle.items.filter((it) => it.status === "skipped");
  const moisture = bundle.moisture.map(
    (m) => `${m.room}, ${m.part}: ${formatReading(m.value, lang)} % WME (${MOISTURE_LEVEL_LABEL[moistureLevel(m.value)][lang]})`,
  );
  const pct = (share: number) => (share * 100).toFixed(1).replace(".", lang === "is" ? "," : ".");
  const costText = r.costLines.length
    ? `${formatIsk(r.costMin, lang)}–${formatIsk(r.costMax, lang)}${i.priceIsk ? ` (${pct(r.costMin / i.priceIsk)}–${pct(r.costMax / i.priceIsk)} % ${lang === "is" ? "af verði" : "of the price"} ${formatIsk(i.priceIsk, lang)})` : ""}`
    : null;
  const checks = listAnnualChecks(rootId).filter((c) => c.status === "ai_report");
  const open = openFindings(rootId);
  const due = day(dueDate(i));
  const problems = listProblems(rootId);

  const text = [
    `Report language: ${lang === "is" ? "Icelandic" : "English"}`,
    `Property: ${formatAddress(i.address, i.postalCode)}${i.fastanumer ? ` (fastanúmer ${i.fastanumer})` : ""}; ${PROPERTY_TYPE_LABEL[i.propertyType].en}, built ${i.buildYear}, ${i.sizeM2} m², ${CONSTRUCTION_LABEL[i.construction].en}, heating: ${HEATING_LABEL[i.heating].en}.`,
    `Report: ${TIER_LABEL[i.tier].en}, created ${day(i.createdAt)}${i.status === "verified" && i.signedAt ? `, signed ${day(i.signedAt)} by ${i.inspectorName} (licence ${i.inspectorLicense})` : i.status === "ai_report" ? ", AI pre-screening, not verified by an inspector" : ""}. Based on photos and notes only.`,
    `Overall grade: ${overall} (${GRADE_INFO[overall].label.en}). Why: ${overallReason} Rule: ${OVERALL_RULE.en}`,
    `Building systems: ${r.systems.map((s) => `${SYSTEM_LABEL[s.system].en}: ${s.tone}`).join("; ")}`,
    `Findings (${findings.length}):\n${findings.map(line).join("\n") || "- none"}`,
    skipped.length ? `Items not assessed: ${skipped.map((it) => `${title(it.itemKey)} (${it.naReason || "not accessible"})`).join("; ")}` : "",
    moisture.length ? `Moisture readings: ${moisture.join("; ")}` : "Moisture readings: none taken.",
    costText ? `Estimated repairs in total: ${costText}` : "",
    `Reference points (information, not legal advice): ${LEGAL_REFERENCE.proposal2pct.en} ${LEGAL_REFERENCE.caseLaw.en}`,
    `History: next yearly check due ${due}; open items now: ${open.length}${open.length ? ` (${open.map((f) => `${f.grade} ${f.title}`).join("; ")})` : ""}.`,
    checks.length
      ? `Completed yearly checks: ${checks
          .map((c) => {
            const t = annualTotals(getFollowUps(c.id), getAnswers(c.id));
            return `${day(c.completedAt ?? c.createdAt)}: ${t.fixed} fixed, ${t.unchanged} unchanged, ${t.worse} worse, ${t.problems} new problems`;
          })
          .join("; ")}`
      : "",
    problems.length
      ? `Problems the owner reported: ${problems.map((p) => `${day(p.createdAt)} ${p.triage ? PROBLEM_CATEGORY_LABEL[p.triage.category].en : ""} "${p.text}" (${p.status})`).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    text,
    facts: {
      lang,
      address: formatAddress(i.address, i.postalCode),
      overall,
      overallReason,
      serious: findings.filter((f) => f.grade === "TG3").map((f) => `${f.title} (${title(f.itemKey)})`),
      significant: findings.filter((f) => f.grade === "TG2").map((f) => `${f.title} (${title(f.itemKey)})`),
      costText,
      moisture,
      dueText: due,
      openCount: open.length,
      notAssessed: skipped.map((it) => title(it.itemKey)),
    },
  };
}

/**
 * Conversations sent to the model alternate and start with a question. In a run of same-role turns (a question
 * that got no answer, then a new one) the newest wins, so the model always answers the question just asked.
 */
export function alternateTurns<T extends { role: "user" | "assistant" }>(messages: T[]): T[] {
  const turns: T[] = [];
  for (const m of messages) {
    if (turns.length && turns[turns.length - 1].role === m.role) turns[turns.length - 1] = m;
    else if (turns.length || m.role === "user") turns.push(m);
  }
  return turns;
}

/** Demo answers without a model: the question's topic picked by keywords, answered from the same facts. */
export function mockAnswer(question: string, f: AssistantFacts): string {
  const q = question.toLowerCase();
  // Answer in the question's language; fall back to the report's.
  const is = /[þðæöáéíóúý]|\b(er|og)\b/.test(q) ? true : /\b(what|when|how|which|is|the|are|and)\b/.test(q) ? false : f.lang === "is";
  const tag = is ? "[Sýnisvar]" : "[Demo answer]";
  const list = (xs: string[]) => xs.join(", ");
  if (/tg3|alvarleg|serious|worst|verst|hættu|danger/.test(q)) {
    return f.serious.length
      ? `${tag} ${is ? "Alvarleg frávik (TG3)" : "Serious deviations (TG3)"}: ${list(f.serious)}.`
      : `${tag} ${is ? "Engin alvarleg frávik (TG3) eru skráð." : "No serious deviations (TG3) are recorded."}`;
  }
  if (/kostn|cost|price|verð|dýr|kr\b/.test(q)) {
    return f.costText
      ? `${tag} ${is ? "Áætlaður viðgerðarkostnaður" : "Estimated repair costs"}: ${f.costText}. ${is ? "Þetta eru gróf bil, ekki tilboð." : "These are rough ranges, not quotes."}`
      : `${tag} ${is ? "Enginn viðgerðarkostnaður er áætlaður í skýrslunni." : "The report estimates no repair costs."}`;
  }
  if (/raki|rak|moist|damp|mygl|mould|mold/.test(q)) {
    return f.moisture.length
      ? `${tag} ${is ? "Rakamælingar" : "Moisture readings"}: ${f.moisture.join("; ")}.`
      : `${tag} ${is ? "Engar rakamælingar voru gerðar. Ef raki er grunaður er mælt með rakamælingu." : "No moisture readings were taken. If you suspect damp, get a moisture measurement."}`;
  }
  if (/næst|árleg|due|yearly|next|hvenær|when/.test(q)) {
    return `${tag} ${is ? `Næsta árlega skoðun: ${f.dueText}. Opin atriði: ${f.openCount}.` : `Next yearly check: ${f.dueText}. Open items: ${f.openCount}.`}`;
  }
  if (/ekki metið|not assessed|óaðgengileg|skipped/.test(q)) {
    return f.notAssessed.length
      ? `${tag} ${is ? "Ekki metið" : "Not assessed"}: ${list(f.notAssessed)}.`
      : `${tag} ${is ? "Allir liðir voru metnir." : "Every item was assessed."}`;
  }
  return `${tag} ${is ? `Heildareinkunn ${f.overall}. ${f.overallReason}` : `Overall grade ${f.overall}. ${f.overallReason}`}${
    f.significant.length ? ` ${is ? "Veruleg frávik (TG2)" : "Significant deviations (TG2)"}: ${list(f.significant)}.` : ""
  }`;
}
