import { describe, expect, it } from "vitest";
import { toNewFindings } from "@/lib/ai";
import { mockAnalyzeItem } from "@/lib/ai/mock";
import { ITEM_SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { ItemAnalysisSchema, type ItemAnalysis } from "@/lib/ai/schema";
import { getTemplate, ITEM_TEMPLATES } from "@/lib/checklist";
import { COST_KEYS } from "@/lib/costs";

const base: ItemAnalysis = {
  photos_sufficient: true,
  retake_requests: [],
  privacy_flags: [],
  item_summary: "ok",
  findings: [
    {
      title: " Móða milli glerja ",
      description: "x",
      grade: "TG2",
      confidence: "high",
      photo_numbers: [2, 2, 5, 0],
      recommended_action: "y",
      follow_up: "none",
      urgency: "within_1y",
      cost_key: "window_glass_unit",
    },
  ],
};

describe("AI output mapping", () => {
  it("maps 1-based photo numbers to ids and drops invalid ones", () => {
    const [f] = toNewFindings(base, ["a", "b", "c"]);
    expect(f.photoIds).toEqual(["b"]);
    expect(f.title).toBe("Móða milli glerja");
    expect(f.costKey).toBe("window_glass_unit");
  });

  it("falls back to 'none' for unknown cost keys", () => {
    const bad = { ...base, findings: [{ ...base.findings[0], cost_key: "gold_plating" }] };
    expect(toNewFindings(bad, ["a"])[0].costKey).toBe("none");
  });

  it("demo analyser output satisfies the schema for every item, in both languages", () => {
    for (const t of ITEM_TEMPLATES) {
      for (const lang of ["is", "en"] as const) {
        expect(ItemAnalysisSchema.safeParse(mockAnalyzeItem(t, 3, lang)).success).toBe(true);
      }
    }
  });

  it("demo analyser asks for more photos when there are too few", () => {
    const r = mockAnalyzeItem(getTemplate("bathroom")!, 1, "en");
    expect(r.photos_sufficient).toBe(false);
    expect(r.retake_requests[0].photo_number).toBeNull();
  });

  it("system prompt is stable and lists every cost key", () => {
    for (const k of COST_KEYS) expect(ITEM_SYSTEM_PROMPT).toContain(`- ${k}:`);
    expect(ITEM_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}T/); // no timestamps → cacheable
  });
});
