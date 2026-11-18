import { z } from "zod";
import { AiError, askAssistant } from "@/lib/ai";
import { alternateTurns } from "@/lib/ai/assistant";
import { assistantQuestionsToday, completeAssistant, dropAssistant, logAssistant } from "@/lib/ownerRepo";
import { fail, readJson } from "@/lib/server/http";
import { finalReport, NOT_FINAL } from "@/lib/server/ownerAccess";

export const maxDuration = 60;

/** Questions per report per 24 hours: the link is shared by design, so cap what it can spend. */
const DAILY_LIMIT = 40;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(12)
    .refine((m) => m[m.length - 1].role === "user", "last message must be the question"),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const report = finalReport(id);
  if (!report) return fail(409, NOT_FINAL);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, { is: "Skrifaðu spurningu.", en: "Write a question." });
  if (assistantQuestionsToday(report.id) >= DAILY_LIMIT) {
    return fail(429, { is: "Hámarksfjölda spurninga í dag er náð. Reyndu aftur á morgun.", en: "Today's question limit is reached. Try again tomorrow." });
  }
  const turns = alternateTurns(parsed.data.messages);
  const question = turns[turns.length - 1].text;
  // Count the question before the model call (no await in between), so parallel requests can't pass the cap.
  const slot = logAssistant(report.id, question, "", "pending");
  try {
    const r = await askAssistant(report.id, turns);
    completeAssistant(slot, r.answer, r.engine, r.usage);
    return Response.json({ answer: r.answer, engine: r.engine });
  } catch (err) {
    dropAssistant(slot);
    if (err instanceof AiError) return fail(err.retryable ? 503 : 400, err.userMessage);
    console.error(`[ask] ${id}`, err);
    return fail(500, { is: "Ekki tókst að svara. Reyndu aftur.", en: "Could not answer. Try again." });
  }
}
