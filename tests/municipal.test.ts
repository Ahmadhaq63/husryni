import { describe, expect, it } from "vitest";
import { drawingArchive } from "@/lib/municipal";

describe("drawing archives by postcode", () => {
  it("maps capital-area and Akureyri postcodes, and nothing else", () => {
    expect(drawingArchive("101")?.url).toContain("skjalasafn.reykjavik.is");
    expect(drawingArchive("116")?.url).toContain("skjalasafn.reykjavik.is"); // Kjalarnes is Reykjavík
    expect(drawingArchive("170")).toBeNull(); // Seltjarnarnes is its own municipality
    expect(drawingArchive("200")?.url).toContain("kopavogur");
    expect(drawingArchive("221")?.url).toContain("hafnarfjordur");
    expect(drawingArchive("225")?.url).toContain("gardabaer"); // Álftanes
    expect(drawingArchive("270")?.url).toContain("moso");
    expect(drawingArchive("600")?.url).toContain("akureyri");
    expect(drawingArchive("800")).toBeNull();
    expect(drawingArchive("abc")).toBeNull();
  });
});
