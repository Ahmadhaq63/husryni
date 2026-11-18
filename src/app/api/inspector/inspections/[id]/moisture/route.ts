import { z } from "zod";
import { addMoisture, getInspection, getItem } from "@/lib/repo";
import { MOISTURE_METHODS } from "@/lib/standard";
import { fail, LOCKED, NOT_FOUND, readJson, UNAUTHORIZED } from "@/lib/server/http";
import { isInspector } from "@/lib/server/session";

const Body = z.object({
  room: z.string().trim().min(1).max(80),
  part: z.string().trim().min(1).max(120),
  /** WME % from a resistance meter. */
  value: z.number().min(0).max(100),
  method: z.enum(MOISTURE_METHODS).default("pin"),
  itemKey: z.string().max(64).nullable().optional(),
});

/** Add a moisture reading taken on site. Only while the report is in review: signed reports are locked. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isInspector())) return fail(401, UNAUTHORIZED);
  const { id } = await ctx.params;
  // Body first: from the status check to the write there must be no await, or a signing could slip in between.
  const body = await readJson(req);
  const inspection = getInspection(id);
  if (!inspection) return fail(404, NOT_FOUND);
  if (inspection.status !== "in_review") return fail(409, LOCKED);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return fail(400, { is: "Skráðu rými, byggingarhluta og mæligildi (0–100).", en: "Enter the room, the building part and a value (0–100)." });
  }
  const itemKey = parsed.data.itemKey || null;
  if (itemKey && !getItem(id, itemKey)) return fail(404, NOT_FOUND);
  const reading = addMoisture({
    inspectionId: id,
    itemKey,
    room: parsed.data.room,
    part: parsed.data.part,
    value: Math.round(parsed.data.value * 10) / 10,
    method: parsed.data.method,
  });
  return Response.json(reading, { status: 201 });
}
