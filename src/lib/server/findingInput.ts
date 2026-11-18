import "server-only";
import { z } from "zod";
import { COST_KEYS } from "../costs";
import { FOLLOW_UPS, GRADES, URGENCIES } from "../types";

const costKey = z.string().refine((k) => k === "none" || (COST_KEYS as string[]).includes(k), "unknown cost key");

export const FindingPatchBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  cause: z.string().trim().max(1000).optional(),
  consequence: z.string().trim().max(1000).optional(),
  grade: z.enum(GRADES).optional(),
  recommendedAction: z.string().trim().max(1000).optional(),
  followUp: z.enum(FOLLOW_UPS).optional(),
  urgency: z.enum(URGENCIES).optional(),
  costKey: costKey.optional(),
  reviewStatus: z.enum(["confirmed", "edited", "rejected"]).optional(),
  inspectorNote: z.string().trim().max(2000).optional(),
});

export const NewFindingBody = z.object({
  itemKey: z.string().min(1).max(64),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
  cause: z.string().trim().max(1000).default(""),
  consequence: z.string().trim().max(1000).default(""),
  grade: z.enum(GRADES),
  recommendedAction: z.string().trim().max(1000),
  followUp: z.enum(FOLLOW_UPS),
  urgency: z.enum(URGENCIES),
  costKey,
  photoIds: z.array(z.string().max(64)).max(8).default([]),
  inspectorNote: z.string().trim().max(2000).optional(),
});
