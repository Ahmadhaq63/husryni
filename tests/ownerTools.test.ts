import { describe, expect, it } from "vitest";
import { mockAnswer, type AssistantFacts } from "@/lib/ai/assistant";
import { offerGuide, computeTotals } from "@/lib/negotiation";
import { draftQuoteLines, iskText, quoteTotals, ruleTriage, SETUP_FEE, TRADE_RATE, tradeFor } from "@/lib/ownerTools";
import type { Finding, Remedy } from "@/lib/types";

const finding = (over: Partial<Finding>): Finding => ({
  id: "f1",
  inspectionId: "i",
  itemKey: "bathroom",
  source: "ai",
  title: "Cracked grout",
  description: "",
  cause: "",
  consequence: "",
  grade: "TG2",
  aiGrade: "TG2",
  confidence: "high",
  photoIds: [],
  recommendedAction: "",
  followUp: "none",
  urgency: "within_1y",
  costKey: "wetroom_reseal",
  reviewStatus: "confirmed",
  inspectorNote: "",
  createdAt: "",
  updatedAt: "",
  ...over,
});

describe("trades and quote drafts", () => {
  it("routes findings to a trade", () => {
    expect(tradeFor(finding({}))).toBe("plumber"); // wet room
    expect(tradeFor(finding({ itemKey: "electrical_panel", costKey: "none" }))).toBe("electrician");
    expect(tradeFor(finding({ itemKey: "gutters", costKey: "none" }))).toBe("sheet_metal");
    expect(tradeFor(finding({ itemKey: "walls_ceilings", costKey: "interior_repaint" }))).toBe("painter");
    expect(tradeFor(finding({ itemKey: "facade", costKey: "none" }))).toBe("mason");
    expect(tradeFor(finding({ itemKey: "floors", costKey: "none", followUp: "plumber" }))).toBe("plumber");
  });
  it("drafts labour + materials per finding and one setup line, excl. VAT", () => {
    const lines = draftQuoteLines([finding({}), finding({ id: "f2", title: "Unknown", costKey: "none" })], "plumber", "en");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatchObject({ unit: "h", unitPrice: TRADE_RATE.plumber });
    expect(lines[0].qty).toBeGreaterThanOrEqual(2);
    expect(lines[1].description).toBe("Cracked grout: materials");
    expect(lines[2]).toMatchObject({ description: "Unknown: assessment and repair", qty: 2 });
    expect(lines[3]).toMatchObject({ qty: 1, unitPrice: SETUP_FEE });
  });
  it("adds 24 % VAT", () => {
    expect(quoteTotals([{ description: "x", qty: 2, unit: "h", unitPrice: 10_000 }])).toEqual({ net: 20_000, vat: 4_800, total: 24_800 });
  });
  it("formats ISK the same on server and browser", () => {
    expect(iskText(1234567, "is")).toBe("1.234.567 kr.");
    expect(iskText(1234567, "en")).toBe("1,234,567 kr.");
    expect(iskText(-500, "is")).toBe("−500 kr.");
  });
});

describe("problem triage (demo rules)", () => {
  it("sends leaks to a plumber within 4 hours with advice", () => {
    expect(ruleTriage("Það lekur úr loftinu á baðinu", "is")).toMatchObject({ category: "water_leak", trade: "plumber", respondWithin: "4h", urgency: "immediate" });
    expect(ruleTriage("Water dripping from the ceiling", "en").advice).toMatch(/main water valve/);
  });
  it("routes electrical, heating and doors", () => {
    expect(ruleTriage("Rafmagnið slær út", "is").trade).toBe("electrician");
    expect(ruleTriage("Ofninn hitnar ekki", "is").category).toBe("heating");
    expect(ruleTriage("The front door won't lock", "en").trade).toBe("carpenter");
    expect(ruleTriage("Something odd", "en")).toMatchObject({ category: "other", respondWithin: "5d" });
  });
});

describe("offer guide", () => {
  it("subtracts reductions, the common-property share and a buffer on TG3 the seller won't fix", () => {
    const a = finding({ id: "a", grade: "TG3", costKey: "wetroom_reseal" });
    const b = finding({ id: "b", grade: "TG2", costKey: "window_glass_unit", itemKey: "windows_int" });
    const remedies = new Map<string, Remedy>([
      ["b", { findingId: "b", inspectionId: "i", action: "price_reduction", amountIsk: 300_000, remark: "", sellerResponse: "none", disputeReason: null, sellerComment: "", fixStatus: "none", fixVerdict: null, updatedAt: "" }],
    ]);
    const totals = computeTotals([a, b], remedies, null);
    const g = offerGuide(60_000_000, [a, b], remedies, totals);
    expect(g.reductions).toBe(300_000);
    expect(g.buffer).toBeGreaterThan(0);
    expect(g.offer % 100_000).toBe(0);
    expect(g.offer).toBeLessThanOrEqual(60_000_000 - 300_000 - g.buffer);
    // The seller fixing the TG3 item removes the buffer.
    remedies.set("a", { ...remedies.get("b")!, findingId: "a", action: "seller_fix", amountIsk: null });
    expect(offerGuide(60_000_000, [a, b], remedies, computeTotals([a, b], remedies, null)).buffer).toBe(0);
  });
});

describe("demo assistant", () => {
  const facts: AssistantFacts = {
    lang: "is",
    address: "Laugavegur 1, 101 Reykjavík",
    overall: "TG2",
    overallReason: "Einn liður er TG3: Baðherbergi.",
    serious: ["Virkur leki (Baðherbergi)"],
    significant: ["Móða milli glerja (Gluggar að innan)"],
    costText: "300.000–900.000 kr.",
    moisture: ["Baðherbergi, veggur: 22 % WME (Blautt)"],
    dueText: "18. nóvember 2027",
    openCount: 3,
    notAssessed: [],
  };
  it("answers from the facts, in the question's language", () => {
    expect(mockAnswer("Hvað er alvarlegast?", facts)).toContain("Virkur leki");
    expect(mockAnswer("What will the repairs cost?", facts)).toMatch(/^\[Demo answer\] Estimated repair costs: 300\.000/);
    expect(mockAnswer("Hvað sýna rakamælingarnar?", facts)).toContain("22 % WME");
    expect(mockAnswer("Hvenær er næsta árlega skoðun?", facts)).toContain("18. nóvember 2027");
  });
});

describe("review fixes", () => {
  it("the offer buffer on a common-property TG3 item is scaled by the buyer's share", () => {
    const roof = finding({ id: "r", itemKey: "roof", grade: "TG3", costKey: "roof_replace" });
    const remedies = new Map<string, Remedy>([
      ["r", { findingId: "r", inspectionId: "i", action: "hoa", amountIsk: null, remark: "", sellerResponse: "none", disputeReason: null, sellerComment: "", fixStatus: "none", fixVerdict: null, updatedAt: "" }],
    ]);
    const totals = computeTotals([roof], remedies, 5);
    const g = offerGuide(60_000_000, [roof], remedies, totals, 5);
    expect(g.hoaShare).toBeGreaterThan(0);
    expect(g.buffer).toBeLessThanOrEqual(Math.ceil((g.hoaShare * 0.2) / 10_000) * 10_000);
    expect(g.offer).toBeGreaterThanOrEqual(60_000_000 - g.hoaShare - g.buffer - 100_000);
  });
  it("keeps the newest question when a turn went unanswered", async () => {
    const { alternateTurns } = await import("@/lib/ai/assistant");
    const u = (text: string) => ({ role: "user" as const, text });
    const a = (text: string) => ({ role: "assistant" as const, text });
    expect(alternateTurns([u("old"), u("new")])).toEqual([u("new")]);
    expect(alternateTurns([a("hi"), u("q1"), a("a1"), u("q2"), u("q3")])).toEqual([u("q1"), a("a1"), u("q3")]);
  });
});
