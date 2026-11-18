import { describe, expect, it } from "vitest";
import { baselineRecommendations, buildChecklist, ITEM_TEMPLATES, riskNotes } from "@/lib/checklist";
import type { PropertyProfile } from "@/lib/types";

const apartment1972: PropertyProfile = {
  propertyType: "fjolbyli",
  buildYear: 1972,
  sizeM2: 85,
  construction: "steypa",
  heating: "hitaveita",
  hasBasement: false,
  hasAttic: false,
};

const house2006: PropertyProfile = {
  propertyType: "einbyli",
  buildYear: 2006,
  sizeM2: 190,
  construction: "steypa",
  heating: "hitaveita",
  hasBasement: true,
  hasAttic: true,
};

describe("checklist", () => {
  it("has unique keys and bilingual texts", () => {
    const keys = ITEM_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of ITEM_TEMPLATES) {
      expect(t.title.is && t.title.en && t.instructions.is && t.instructions.en && t.lookFor).toBeTruthy();
    }
  });

  it("tailors items to an apartment", () => {
    const keys = buildChecklist(apartment1972).map((t) => t.key);
    expect(keys).not.toContain("foundation_drainage"); // shared property in a block
    expect(keys).not.toContain("attic");
    expect(keys).toContain("basement_storage"); // storage room in the building
    expect(keys).toContain("hoa_statement");
  });

  it("tailors items to a detached house", () => {
    const keys = buildChecklist(house2006).map((t) => t.key);
    expect(keys).toContain("foundation_drainage");
    expect(keys).toContain("attic");
    expect(keys).not.toContain("hoa_statement");
  });

  it("adds items from the property's features (question-driven checklist)", () => {
    const plain = buildChecklist(house2006).map((t) => t.key);
    expect(plain).not.toContain("garage");
    expect(plain).not.toContain("chimney_fireplace");
    expect(plain).not.toContain("hot_tub");
    const rich = buildChecklist({ ...house2006, hasGarage: true, hasFireplace: true, hasHotTub: true }).map((t) => t.key);
    expect(rich).toEqual(expect.arrayContaining(["garage", "chimney_fireplace", "hot_tub"]));
  });

  it("adds crawl space for timber/summer houses and a hot-water tank without district heating", () => {
    expect(buildChecklist(house2006).map((t) => t.key)).not.toContain("crawl_space");
    expect(buildChecklist({ ...house2006, propertyType: "sumarhus", construction: "timbur" }).map((t) => t.key)).toContain("crawl_space");
    expect(buildChecklist(house2006).map((t) => t.key)).not.toContain("hot_water_tank");
    expect(buildChecklist({ ...house2006, heating: "rafmagn" }).map((t) => t.key)).toContain("hot_water_tank");
  });

  it("adds era risk notes", () => {
    const ids = riskNotes(apartment1972, 2026).map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining(["asr", "asbestos", "old_pipes", "old_electrical", "district_heating"]));
    expect(riskNotes(house2006, 2026).map((n) => n.id)).not.toContain("asbestos");
    expect(ids).not.toContain("recent_build");
    expect(riskNotes(house2006, 2026).map((n) => n.id)).not.toContain("recent_build");
    expect(riskNotes({ ...house2006, buildYear: 2018 }, 2026).map((n) => n.id)).toContain("recent_build");
    expect(riskNotes({ ...apartment1972, buildYear: 1985 }, 2026).map((n) => n.id)).not.toContain("asr");
  });

  it("recommends a sewer camera for older homes only", () => {
    expect(baselineRecommendations(apartment1972, 2026).map((r) => r.followUp)).toEqual(["sewer_camera", "electrician"]);
    expect(baselineRecommendations({ ...house2006, buildYear: 2015 }, 2026)).toEqual([]);
  });
});
