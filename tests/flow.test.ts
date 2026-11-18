import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolated database for this test file.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "husryni-test-"));
process.env.DATA_DIR = dir;
process.env.AI_MODE = "mock";

const repo = await import("@/lib/repo");
const { analyzeInspectionItem } = await import("@/lib/ai");
const { buildReport, readyToSubmit } = await import("@/lib/report");
const { savePhotoFile } = await import("@/lib/storage");
const { checkSeal, computeSeal } = await import("@/lib/seal");

// 1×1 white JPEG
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64",
);

let id = "";

beforeAll(() => {
  id = repo.createInspection({
    tier: "verified",
    purpose: "buyer",
    lang: "is",
    address: "Prufugata 1",
    postalCode: "101",
    fastanumer: null,
    contactName: "Test",
    contactEmail: "test@example.com",
    propertyType: "fjolbyli",
    buildYear: 1972,
    sizeM2: 85,
    construction: "steypa",
    heating: "hitaveita",
    hasBasement: false,
    hasAttic: false,
    priceIsk: 60_000_000,
  });
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("inspection flow (demo engine)", () => {
  it("creates the tailored checklist", () => {
    const b = repo.getBundle(id)!;
    expect(b.inspection.status).toBe("capturing");
    expect(b.items.map((i) => i.itemKey)).toContain("bathroom");
    expect(readyToSubmit(b).ok).toBe(false);
  });

  it("analyses an item and stores findings", async () => {
    for (let i = 0; i < 3; i++) {
      const pid = repo.newId(12);
      await savePhotoFile(id, pid, "image/jpeg", JPEG);
      repo.addPhoto({ id: pid, inspectionId: id, itemKey: "bathroom", source: "camera", mime: "image/jpeg", sizeBytes: JPEG.length });
    }
    const rec = await analyzeInspectionItem(id, "bathroom");
    expect(rec.engine).toBe("mock");
    const b = repo.getBundle(id)!;
    expect(b.items.find((i) => i.itemKey === "bathroom")!.status).toBe("analyzed");
    const f = b.findings.filter((x) => x.itemKey === "bathroom");
    expect(f).toHaveLength(1);
    expect(f[0].grade).toBe("TG2");
    expect(f[0].photoIds).toHaveLength(1);
  });

  it("skips the instant photo check in demo mode without failing", async () => {
    const { checkPhoto } = await import("@/lib/ai");
    const pid = repo.getBundle(id)!.photos[0].id;
    await expect(checkPhoto(pid)).resolves.toEqual({ status: "unchecked", reason: null });
    expect(repo.getPhoto(pid)!.checkStatus).toBe("unchecked");
  });

  it("marks analysis stale when photos change, and re-analysis replaces AI findings", async () => {
    const pid = repo.newId(12);
    await savePhotoFile(id, pid, "image/jpeg", JPEG);
    repo.addPhoto({ id: pid, inspectionId: id, itemKey: "bathroom", source: "camera", mime: "image/jpeg", sizeBytes: JPEG.length });
    expect(repo.getItem(id, "bathroom")!.status).toBe("pending");
    await analyzeInspectionItem(id, "bathroom");
    expect(repo.getBundle(id)!.findings.filter((x) => x.itemKey === "bathroom")).toHaveLength(1);
  });

  it("drops AI findings when an analysed item is marked not accessible", async () => {
    const pid = repo.newId(12);
    await savePhotoFile(id, pid, "image/jpeg", JPEG);
    repo.addPhoto({ id: pid, inspectionId: id, itemKey: "kitchen", source: "upload", mime: "image/jpeg", sizeBytes: JPEG.length });
    await analyzeInspectionItem(id, "kitchen");
    expect(repo.getBundle(id)!.findings.some((f) => f.itemKey === "kitchen")).toBe(true);

    repo.updateItem(id, "kitchen", { notAccessible: true });
    const b = repo.getBundle(id)!;
    expect(b.findings.some((f) => f.itemKey === "kitchen")).toBe(false);
    expect(repo.getItem(id, "kitchen")).toMatchObject({ status: "skipped", analysis: null });

    repo.updateItem(id, "kitchen", { notAccessible: false });
    expect(repo.getItem(id, "kitchen")!.status).toBe("pending");
    repo.updateItem(id, "kitchen", { notAccessible: true });
  });

  it("is ready to submit once every required item is analysed, or skipped with a reason", () => {
    const b = repo.getBundle(id)!;
    for (const item of b.items) {
      if (item.itemKey !== "bathroom") repo.updateItem(id, item.itemKey, { notAccessible: true });
    }
    // The standard: "not assessed" needs a reason.
    const first = readyToSubmit(repo.getBundle(id)!);
    expect(first.ok).toBe(false);
    expect(first.missingReason).toContain("kitchen");
    for (const item of b.items) {
      if (item.itemKey !== "bathroom") repo.updateItem(id, item.itemKey, { naReason: "Læst geymsla" });
    }
    expect(readyToSubmit(repo.getBundle(id)!).ok).toBe(true);
    expect(repo.getItem(id, "kitchen")!.naReason).toBe("Læst geymsla");
    // Opening the item again clears the reason.
    repo.updateItem(id, "kitchen", { notAccessible: false });
    expect(repo.getItem(id, "kitchen")!.naReason).toBe("");
    repo.updateItem(id, "kitchen", { notAccessible: true, naReason: "Læst geymsla" });
  });

  it("keeps the AI's original grade when the inspector edits a finding", () => {
    const f = repo.getBundle(id)!.findings.find((x) => x.source === "ai")!;
    expect(f.aiGrade).toBe(f.grade);
    expect(f.cause).not.toBe("");
    const edited = repo.updateFinding(f.id, { grade: "TG3", reviewStatus: "edited" })!;
    expect(edited.grade).toBe("TG3");
    expect(edited.aiGrade).toBe("TG2");
    repo.updateFinding(f.id, { grade: "TG2", reviewStatus: "confirmed" });
  });

  it("builds the report: rejected findings drop out, costs and baseline follow-ups appear", () => {
    let r = buildReport(repo.getBundle(id)!);
    expect(r.counts.TG2).toBe(1);
    expect(r.costLines).toHaveLength(1);
    expect(r.costMin).toBeGreaterThan(0);
    expect(r.followUps.map((f) => f.followUp)).toEqual(expect.arrayContaining(["moisture_measurement", "sewer_camera", "electrician"]));
    expect(r.usedMock).toBe(true);

    const finding = repo.getBundle(id)!.findings[0];
    repo.updateFinding(finding.id, { reviewStatus: "rejected" });
    r = buildReport(repo.getBundle(id)!);
    expect(r.counts.TG2).toBe(0);
    expect(r.costLines).toHaveLength(0);
  });

  it("records the inspector sign-off with the standard, the overall grade and a seal that detects changes", async () => {
    repo.setStatus(id, "in_review");
    repo.addMoisture({ inspectionId: id, itemKey: "bathroom", room: "Baðherbergi", part: "Veggur við sturtu", value: 22, method: "pin" });
    const bundle = repo.getBundle(id)!;
    const at = new Date().toISOString();
    const fields = {
      name: "Jón Jónsson",
      license: "12345",
      statement: "Yfirfarið.",
      signedAt: at,
      declaredAt: at,
      feeIsk: 49_900,
      standardVersion: "1.0",
      overallGrade: buildReport(bundle).overall.grade,
    };
    const seal = await computeSeal(bundle, fields);
    expect(seal).toMatch(/^[0-9a-f]{64}$/);
    expect(await computeSeal(repo.getBundle(id)!, fields)).toBe(seal); // deterministic
    expect(repo.sealInspection(id, { ...fields, reportHash: seal })).toBe(true);
    expect(repo.sealInspection(id, { ...fields, reportHash: seal })).toBe(false); // only once

    const i = repo.getInspection(id)!;
    expect(i).toMatchObject({ status: "verified", inspectorName: "Jón Jónsson", feeIsk: 49_900, standardVersion: "1.0", reportHash: seal });
    expect(i.overallGrade).toBe("TG0"); // the only TG2 finding was rejected
    expect(repo.findBySealPrefix(seal.slice(0, 16))!.id).toBe(id);
    expect((await checkSeal(id))!.status).toBe("intact");

    // A summary finishing after signing (a second sign request) must not change the sealed report.
    repo.saveSummary(id, { engine: "mock", overall: "late", keyRisks: [], advice: "", generatedAt: "" });
    expect(repo.getInspection(id)!.summary?.overall).not.toBe("late");
    expect((await checkSeal(id))!.status).toBe("intact");

    // What the report shows is sealed, the AI confidence included.
    const f0 = repo.getBundle(id)!.findings[0];
    const { getDb } = await import("@/lib/db");
    getDb().prepare("UPDATE findings SET confidence = 'low' WHERE id = ?").run(f0.id);
    expect((await checkSeal(id))!.status).toBe("changed");
    getDb().prepare("UPDATE findings SET confidence = ? WHERE id = ?").run(f0.confidence, f0.id);
    expect((await checkSeal(id))!.status).toBe("intact");

    // The seller's repair photos (negotiation, after signing) are not part of the signed report.
    const fixPid = repo.newId(12);
    await savePhotoFile(id, fixPid, "image/jpeg", JPEG);
    repo.addPhoto({ id: fixPid, inspectionId: id, itemKey: `fix:${repo.getBundle(id)!.findings[0].id}`, source: "camera", mime: "image/jpeg", sizeBytes: JPEG.length });
    expect((await checkSeal(id))!.status).toBe("intact");

    // Any change after signing breaks the seal: a finding, a reading or a photo.
    const f = repo.getBundle(id)!.findings[0];
    repo.updateFinding(f.id, { title: f.title + " (breytt)" });
    expect((await checkSeal(id))!.status).toBe("changed");
    repo.updateFinding(f.id, { title: f.title });
    expect((await checkSeal(id))!.status).toBe("intact");
    const photo = repo.getBundle(id)!.photos[0];
    await savePhotoFile(id, photo.id, "image/jpeg", Buffer.concat([JPEG, Buffer.from([0])]));
    expect((await checkSeal(id))!.status).toBe("changed");
  });
});
