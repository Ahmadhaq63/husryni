import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "husryni-neg-"));
process.env.DATA_DIR = dir;
process.env.AI_MODE = "mock";

const repo = await import("@/lib/repo");
const nrepo = await import("@/lib/negotiationRepo");
const { computeTotals, estimateIsk, likelyCommonProperty, negotiableFindings } = await import("@/lib/negotiation");
const { analyzeInspectionItem, verifyFix } = await import("@/lib/ai");
const { savePhotoFile } = await import("@/lib/storage");

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
let id = "";

async function photo(itemKey: string) {
  const pid = repo.newId(12);
  await savePhotoFile(id, pid, "image/jpeg", JPEG);
  repo.addPhoto({ id: pid, inspectionId: id, itemKey, source: "camera", mime: "image/jpeg", sizeBytes: JPEG.length });
}

beforeAll(async () => {
  id = repo.createInspection({
    tier: "basic",
    purpose: "buyer",
    lang: "is",
    address: "Samningsgata 4",
    postalCode: "107",
    fastanumer: null,
    contactName: "Kaupandi",
    contactEmail: "k@example.com",
    priceIsk: 60_000_000,
    propertyType: "fjolbyli",
    buildYear: 1972,
    sizeM2: 80,
    construction: "steypa",
    heating: "hitaveita",
    hasBasement: false,
    hasAttic: false,
  });
  for (const [key, n] of [["bathroom", 3], ["roof", 2], ["facade", 2]] as const) {
    for (let i = 0; i < n; i++) await photo(key);
    await analyzeInspectionItem(id, key);
  }
  repo.setStatus(id, "ai_report");
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const findingFor = (key: string) => repo.getBundle(id)!.findings.find((f) => f.itemKey === key)!;

describe("remedies & negotiation", () => {
  it("lists TG1–TG3 findings, most severe first, and flags likely common property", () => {
    const f = negotiableFindings(repo.getBundle(id)!);
    expect(f.map((x) => x.grade)).toEqual(["TG2", "TG2", "TG1"]);
    expect(likelyCommonProperty("facade", "fjolbyli")).toBe(true);
    expect(likelyCommonProperty("bathroom", "fjolbyli")).toBe(false);
    expect(likelyCommonProperty("facade", "einbyli")).toBe(false);
  });

  it("computes totals with the buyer's share of common property", () => {
    nrepo.ensureNegotiation(id);
    nrepo.updateNegotiation(id, { ownerSharePct: 10 });
    nrepo.setRemedyAction(id, findingFor("bathroom").id, { action: "seller_fix" });
    nrepo.setRemedyAction(id, findingFor("facade").id, { action: "hoa" });
    nrepo.setRemedyAction(id, findingFor("roof").id, { action: "price_reduction", amountIsk: 500_000 });

    expect(estimateIsk(findingFor("bathroom"))).toBe(150_000); // wetroom_reseal 50k–250k
    expect(estimateIsk(findingFor("facade"))).toBe(900_000); // facade_crack_repair 300k–1.5m
    const t = computeTotals(negotiableFindings(repo.getBundle(id)!), nrepo.listRemedies(id), 10);
    expect(t.priceReduction).toBe(500_000);
    expect(t.sellerFixValue).toBe(150_000);
    expect(t.requestedFromSeller).toBe(650_000);
    expect(t.hoaFullCost).toBe(900_000);
    expect(t.hoaBuyerShare).toBe(90_000);
    expect(t.buyerBears).toBe(90_000);
    expect(t.allRepairs).toBe(150_000 + 90_000 + 1_400_000); // roof_repaint midpoint 1.4m
    expect(t.counts).toMatchObject({ seller_fix: 1, hoa: 1, price_reduction: 1, accept: 0, none: 0 });
  });

  it("records the seller's answer, and resets it when the buyer changes the action", () => {
    const fid = findingFor("roof").id;
    nrepo.setSellerResponse(fid, { sellerResponse: "disputed", disputeReason: "already_disclosed", sellerComment: "Í söluyfirliti" });
    expect(nrepo.getRemedy(fid)).toMatchObject({ sellerResponse: "disputed", disputeReason: "already_disclosed" });

    nrepo.setRemedyAction(id, fid, { action: "price_reduction", amountIsk: 400_000 }); // same action: answer kept
    expect(nrepo.getRemedy(fid)!.sellerResponse).toBe("disputed");
    nrepo.setRemedyAction(id, fid, { action: "accept" }); // new action: answer reset
    expect(nrepo.getRemedy(fid)).toMatchObject({ sellerResponse: "none", disputeReason: null });
  });

  it("verifies a repair from before/after photos (demo engine)", async () => {
    const fid = findingFor("bathroom").id;
    await expect(verifyFix(id, fid)).rejects.toThrow(/after photos/);

    const pid = repo.newId(12);
    await savePhotoFile(id, pid, "image/jpeg", JPEG);
    repo.addPhoto({ id: pid, inspectionId: id, itemKey: nrepo.fixItemKey(fid), source: "camera", mime: "image/jpeg", sizeBytes: JPEG.length });
    let v = await verifyFix(id, fid);
    expect(v.verdict).toBe("cannot_tell"); // one photo can't prove it's the same spot

    const pid2 = repo.newId(12);
    await savePhotoFile(id, pid2, "image/jpeg", JPEG);
    repo.addPhoto({ id: pid2, inspectionId: id, itemKey: nrepo.fixItemKey(fid), source: "camera", mime: "image/jpeg", sizeBytes: JPEG.length });
    v = await verifyFix(id, fid);
    expect(v.verdict).toBe("fixed");
    expect(nrepo.getRemedy(fid)).toMatchObject({ fixStatus: "fixed" });
    // after-repair photos never leak into the report's component sections
    expect(repo.getBundle(id)!.items.some((i) => i.itemKey.startsWith("fix:"))).toBe(false);
  });

  it("refuses to verify items that are not seller repairs", async () => {
    await expect(verifyFix(id, findingFor("facade").id)).rejects.toThrow(/not a repair/);
  });
});
