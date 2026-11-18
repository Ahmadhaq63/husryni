import type { AnnualAnswer, FollowUp, FollowUpRecord, FollowUpVerdictValue, Grade, L10n, QuestionAnswer, Urgency } from "./types";

/**
 * The yearly owner check (property history). Once a year the owner confirms the condition in about ten
 * minutes: first what happened to each open finding from earlier reports (fixed / unchanged / worse,
 * with a photo that the AI compares with the report's photos), then ten plain-language questions.
 * Problems found become new findings on the property's history. Pure logic only (client-safe).
 */

export interface AnnualQuestion {
  id: string;
  /** Checklist item the question belongs to (src/lib/checklist.ts). */
  itemKey: string;
  text: L10n;
  /** The answer that means there is a problem. */
  problemAnswer: "yes" | "no";
  /** Title of the finding created when the answer is a problem. */
  findingTitle: L10n;
  grade: Grade;
  urgency: Urgency;
  followUp: FollowUp;
}

export const ANNUAL_QUESTIONS: AnnualQuestion[] = [
  {
    id: "damp",
    itemKey: "bathroom",
    text: {
      is: "Sérðu raka eða myglubletti, eða finnurðu fúkkalykt, á baði eða í þvottahúsi?",
      en: "Do you see damp or mould spots, or notice a musty smell, in the bathroom or laundry?",
    },
    problemAnswer: "yes",
    findingTitle: { is: "Raki eða mygla í votrými (tilkynnt af eiganda)", en: "Damp or mould in a wet room (reported by the owner)" },
    grade: "TG2",
    urgency: "within_1y",
    followUp: "moisture_measurement",
  },
  {
    id: "leak",
    itemKey: "water_pipes",
    text: { is: "Er leki undir vaski, við salerni eða við sturtu?", en: "Is there a leak under a sink, by the toilet or at the shower?" },
    problemAnswer: "yes",
    findingTitle: { is: "Leki frá lögnum (tilkynnt af eiganda)", en: "Leak from pipes (reported by the owner)" },
    grade: "TG3",
    urgency: "immediate",
    followUp: "plumber",
  },
  {
    id: "drains",
    itemKey: "sewer",
    text: { is: "Renna öll niðurföll eðlilega?", en: "Do all drains run normally?" },
    problemAnswer: "no",
    findingTitle: { is: "Niðurfall rennur illa (tilkynnt af eiganda)", en: "Slow drain (reported by the owner)" },
    grade: "TG2",
    urgency: "within_1y",
    followUp: "plumber",
  },
  {
    id: "radiators",
    itemKey: "radiators_floorheat",
    text: { is: "Hitna allir ofnar jafnt?", en: "Do all radiators heat up evenly?" },
    problemAnswer: "no",
    findingTitle: { is: "Ofn hitnar ekki eðlilega (tilkynnt af eiganda)", en: "Radiator not heating properly (reported by the owner)" },
    grade: "TG2",
    urgency: "within_1y",
    followUp: "plumber",
  },
  {
    id: "windows",
    itemKey: "windows_int",
    text: { is: "Loka gluggar þétt og er glerið laust við móðu á milli glerja?", en: "Do the windows close tightly, with no fogging between the panes?" },
    problemAnswer: "no",
    findingTitle: { is: "Gluggi lokar illa eða móða milli glerja (tilkynnt af eiganda)", en: "Window not closing or fogged glass (reported by the owner)" },
    grade: "TG2",
    urgency: "within_1y",
    followUp: "none",
  },
  {
    id: "doors",
    itemKey: "windows_ext",
    text: { is: "Virka útihurðir og læsingar eins og þær eiga að gera?", en: "Do the outside doors and locks work as they should?" },
    problemAnswer: "no",
    findingTitle: { is: "Hurð eða læsing virkar illa (tilkynnt af eiganda)", en: "Door or lock not working (reported by the owner)" },
    grade: "TG1",
    urgency: "within_1y",
    followUp: "none",
  },
  {
    id: "electrical",
    itemKey: "electrical_panel",
    text: { is: "Slá öryggi út eða eru tenglar skemmdir?", en: "Do fuses trip, or are any sockets damaged?" },
    problemAnswer: "yes",
    findingTitle: { is: "Rafmagn slær út eða skemmdur tengill (tilkynnt af eiganda)", en: "Tripping fuses or damaged socket (reported by the owner)" },
    grade: "TG2",
    urgency: "within_1y",
    followUp: "electrician",
  },
  {
    id: "smoke_alarm",
    itemKey: "fire_safety",
    text: { is: "Pípir reykskynjarinn þegar þú ýtir á prófunarhnappinn?", en: "Does the smoke alarm beep when you press its test button?" },
    problemAnswer: "no",
    findingTitle: { is: "Reykskynjari virkar ekki (tilkynnt af eiganda)", en: "Smoke alarm not working (reported by the owner)" },
    grade: "TG2",
    urgency: "immediate",
    followUp: "none",
  },
  {
    id: "cracks",
    itemKey: "walls_ceilings",
    text: { is: "Sérðu nýjar sprungur í veggjum, lofti eða gólfi?", en: "Do you see new cracks in walls, ceilings or floors?" },
    problemAnswer: "yes",
    findingTitle: { is: "Nýjar sprungur (tilkynnt af eiganda)", en: "New cracks (reported by the owner)" },
    grade: "TG2",
    urgency: "within_1y",
    followUp: "structural_engineer",
  },
  {
    id: "rain_leak",
    itemKey: "roof",
    text: { is: "Lekur inn um loft eða glugga þegar rignir?", en: "Does water come in through a ceiling or window when it rains?" },
    problemAnswer: "yes",
    findingTitle: { is: "Leki í rigningu (tilkynnt af eiganda)", en: "Leak when it rains (reported by the owner)" },
    grade: "TG3",
    urgency: "immediate",
    followUp: "roofer",
  },
];

export const getQuestion = (id: string) => ANNUAL_QUESTIONS.find((q) => q.id === id);
export const isProblem = (q: AnnualQuestion, answer: QuestionAnswer | null) => answer === q.problemAnswer;

/** Photo keys inside a yearly check: one set per follow-up and per question. */
export const followUpPhotoKey = (findingId: string) => `fu:${findingId}`;
export const questionPhotoKey = (questionId: string) => `q:${questionId}`;

/**
 * Closed when the owner says fixed, unless the photo comparison disagrees (partly fixed, unchanged, worse).
 * "Can't tell" from the photos doesn't reopen it: an unclear photo must not count for less than no photo.
 */
export function isResolved(fu: Pick<FollowUpRecord, "answer" | "verdict">): boolean {
  if (fu.answer !== "fixed") return false;
  const v = fu.verdict?.verdict;
  return !v || v === "fixed" || v === "cannot_tell";
}

/** The owner's answer and the photo comparison disagree (worth a closer look). */
export function isContradicted(fu: Pick<FollowUpRecord, "answer" | "verdict">): boolean {
  if (!fu.answer || !fu.verdict || fu.verdict.verdict === "cannot_tell") return false;
  const v = fu.verdict.verdict;
  if (fu.answer === "fixed") return v !== "fixed";
  if (fu.answer === "unchanged") return v === "fixed" || v === "worse";
  return v === "fixed";
}

export interface AnnualTotals {
  followUps: number;
  fixed: number;
  unchanged: number;
  worse: number;
  unanswered: number;
  photoChecked: number;
  contradicted: number;
  problems: number;
  unsure: number;
  questionsAnswered: number;
}

export function annualTotals(followups: FollowUpRecord[], answers: AnnualAnswer[]): AnnualTotals {
  const byQ = new Map(answers.map((a) => [a.questionId, a.answer]));
  return {
    followUps: followups.length,
    fixed: followups.filter((f) => f.answer === "fixed").length,
    unchanged: followups.filter((f) => f.answer === "unchanged").length,
    worse: followups.filter((f) => f.answer === "worse").length,
    unanswered: followups.filter((f) => !f.answer).length,
    photoChecked: followups.filter((f) => f.verdict).length,
    contradicted: followups.filter(isContradicted).length,
    problems: ANNUAL_QUESTIONS.filter((q) => isProblem(q, byQ.get(q.id) ?? null)).length,
    unsure: ANNUAL_QUESTIONS.filter((q) => byQ.get(q.id) === "unknown").length,
    questionsAnswered: ANNUAL_QUESTIONS.filter((q) => byQ.get(q.id)).length,
  };
}

/** What still blocks submitting a yearly check. */
export function annualMissing(followups: FollowUpRecord[], answers: AnnualAnswer[]): { followUps: string[]; questions: string[] } {
  const answered = new Set(answers.filter((a) => a.answer).map((a) => a.questionId));
  return {
    followUps: followups.filter((f) => !f.answer).map((f) => f.findingId),
    questions: ANNUAL_QUESTIONS.filter((q) => !answered.has(q.id)).map((q) => q.id),
  };
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** The next yearly check is due a year after the condition was last confirmed. */
export const nextDue = (lastConfirmedIso: string) => new Date(new Date(lastConfirmedIso).getTime() + YEAR_MS).toISOString();
export const isOverdue = (dueIso: string, now = Date.now()) => new Date(dueIso).getTime() <= now;

export const FOLLOWUP_VERDICT_LABEL: Record<FollowUpVerdictValue, L10n> = {
  fixed: { is: "Lagað", en: "Fixed" },
  partially_fixed: { is: "Lagað að hluta", en: "Partly fixed" },
  unchanged: { is: "Óbreytt", en: "Unchanged" },
  worse: { is: "Versnað", en: "Worse" },
  cannot_tell: { is: "Ekki hægt að meta", en: "Can't tell" },
};
