import { describe, expect, it } from "vitest";
import { ITEM_TEMPLATES } from "@/lib/checklist";
import {
  agreementPairs,
  agreementStats,
  canonicalJson,
  ITEM_SYSTEM,
  moistureLevel,
  normalizeFingerprint,
  overallGrade,
  overallItemOf,
  shortFingerprint,
  SYSTEMS,
  systemStatuses,
  type OverallItem,
} from "@/lib/standard";
import type { Finding, Grade } from "@/lib/types";

const item = (itemKey: string, worst: Grade | null, urgent = false, skipped = false): OverallItem => ({ itemKey, worst, urgent, skipped });

describe("overall grade (published rule)", () => {
  it("is TG0 without deviations, TG1 with minor or few significant ones", () => {
    expect(overallGrade([item("a", null), item("b", "TG0")]).grade).toBe("TG0");
    expect(overallGrade([item("a", "TG1")]).grade).toBe("TG1");
    expect(overallGrade([item("a", "TG2"), item("b", "TG2"), item("c", "TG1")])).toMatchObject({ grade: "TG1", reason: "deviations" });
  });
  it("is TG2 with one TG3 item or three TG2 items", () => {
    expect(overallGrade([item("a", "TG3")])).toMatchObject({ grade: "TG2", reason: "one_tg3", tg3Items: ["a"] });
    expect(overallGrade([item("a", "TG2"), item("b", "TG2"), item("c", "TG2")])).toMatchObject({ grade: "TG2", reason: "three_tg2" });
  });
  it("is TG3 with an urgent item or two TG3 items", () => {
    expect(overallGrade([item("a", "TG3", true)])).toMatchObject({ grade: "TG3", reason: "urgent", urgentItems: ["a"] });
    expect(overallGrade([item("a", "TG3"), item("b", "TG3")])).toMatchObject({ grade: "TG3", reason: "two_tg3" });
  });
  it("ignores items that were not assessed but lists them", () => {
    const r = overallGrade([item("a", "TG3", true, true), item("b", "TG1")]);
    expect(r).toMatchObject({ grade: "TG1", notAssessed: ["a"] });
  });
  it("counts an item once, by its worst active finding; urgent means TG3 + immediate", () => {
    const i = overallItemOf("bathroom", false, [
      { grade: "TG2", urgency: "immediate" },
      { grade: "TG3", urgency: "within_1y" },
    ]);
    expect(i).toEqual({ itemKey: "bathroom", worst: "TG3", urgent: false, skipped: false });
    expect(overallItemOf("x", false, [{ grade: "TG3", urgency: "immediate" }]).urgent).toBe(true);
  });
});

describe("building systems", () => {
  it("maps every checklist item to one of the ten systems", () => {
    for (const t of ITEM_TEMPLATES) expect(ITEM_SYSTEM[t.key], t.key).toBeDefined();
    expect(new Set(Object.values(ITEM_SYSTEM)).size).toBe(SYSTEMS.length);
  });
  it("gives each system a traffic light", () => {
    const s = systemStatuses([
      { itemKey: "bathroom", skipped: false, analyzed: true, worst: "TG3", findingTitles: ["Leki"] },
      { itemKey: "laundry", skipped: false, analyzed: true, worst: "TG1", findingTitles: [] },
      { itemKey: "roof", skipped: false, analyzed: true, worst: null, findingTitles: [] },
      { itemKey: "facade", skipped: true, analyzed: false, worst: null, findingTitles: [] },
      { itemKey: "windows_int", skipped: false, analyzed: true, worst: "TG2", findingTitles: ["Móða"] },
    ]);
    const tone = (k: string) => s.find((x) => x.system === k)!.tone;
    expect(tone("wet_rooms")).toBe("red");
    expect(tone("windows_doors")).toBe("amber");
    expect(tone("roof")).toBe("green");
    expect(tone("exterior_walls")).toBe("grey");
    expect(tone("electrical")).toBe("none");
    expect(s).toHaveLength(10);
  });
});

describe("moisture scale", () => {
  it("classifies WME readings", () => {
    expect(moistureLevel(12)).toBe("dry");
    expect(moistureLevel(16.9)).toBe("dry");
    expect(moistureLevel(17)).toBe("at_risk");
    expect(moistureLevel(20)).toBe("at_risk");
    expect(moistureLevel(20.1)).toBe("wet");
  });
});

describe("AI–inspector agreement", () => {
  const f = (itemKey: string, source: Finding["source"], grade: Grade, aiGrade: Grade | null, reviewStatus: Finding["reviewStatus"] = "confirmed") => ({
    itemKey,
    source,
    grade,
    aiGrade,
    reviewStatus,
  });
  it("compares the AI's original worst grade with the inspector's final one, per item", () => {
    const items = ["a", "b", "c", "d", "e", "f"].map((k) => ({ itemKey: k, analyzed: true, skipped: false }));
    const pairs = agreementPairs(items, [
      f("a", "ai", "TG2", "TG2"), // confirmed: same
      f("b", "ai", "TG3", "TG2", "edited"), // edited one step: adjacent
      f("c", "ai", "TG2", "TG2", "rejected"), // rejected: TG2 vs TG0
      f("d", "inspector", "TG3", null), // AI saw nothing, inspector TG3
      f("e", "ai", "TG1", null, "edited"), // original unknown: left out
    ]);
    expect(pairs).toEqual([
      { itemKey: "a", ai: "TG2", inspector: "TG2" },
      { itemKey: "b", ai: "TG2", inspector: "TG3" },
      { itemKey: "c", ai: "TG2", inspector: "TG0" },
      { itemKey: "d", ai: "TG0", inspector: "TG3" },
      { itemKey: "f", ai: "TG0", inspector: "TG0" },
    ]);
    expect(agreementStats(pairs)).toEqual({ items: 5, exact: 2, withinOne: 3, exactPct: 40, withinOnePct: 60 });
  });
  it("leaves out items that were not analysed or not assessed", () => {
    expect(agreementPairs([{ itemKey: "a", analyzed: false, skipped: true }], [])).toEqual([]);
    expect(agreementStats([]).withinOnePct).toBeNull();
  });
});

describe("seal helpers", () => {
  it("canonical JSON sorts keys at every level and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { y: 1, x: 2 }], c: undefined } })).toBe('{"a":{"d":[3,{"x":2,"y":1}]},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });
  it("formats and normalises fingerprints", () => {
    const h = "3f2a9c1b77d04e21aa" + "0".repeat(46);
    expect(shortFingerprint(h)).toBe("3F2A-9C1B-77D0-4E21");
    expect(normalizeFingerprint("3F2A-9C1B-77D0-4E21")).toBe("3f2a9c1b77d04e21");
    expect(normalizeFingerprint(" 3f2a 9c1b ")).toBeNull(); // too short
    expect(normalizeFingerprint("zzzz-9c1b-77d0-4e21")).toBeNull();
  });
});

describe("review fixes", () => {
  it("a TG2 finding needing immediate action doesn't make the overall grade TG3 (the rule says TG3 + immediate)", () => {
    const i = overallItemOf("fire_safety", false, [{ grade: "TG2", urgency: "immediate" }]);
    expect(i.urgent).toBe(false);
    expect(overallGrade([i]).grade).toBe("TG1");
  });
  it("an item whose only findings are TGIU counts as not assessed", () => {
    const i = overallItemOf("electrical_panel", false, [{ grade: "TGIU", urgency: "monitor" }]);
    expect(i.skipped).toBe(true);
    expect(overallGrade([i])).toMatchObject({ grade: "TG0", notAssessed: ["electrical_panel"] });
    const s = systemStatuses([{ itemKey: "electrical_panel", skipped: i.skipped, analyzed: true, worst: "TGIU", findingTitles: [] }]);
    expect(s.find((x) => x.system === "electrical")).toMatchObject({ tone: "grey", assessed: 0, notAssessed: 1 });
  });
});
