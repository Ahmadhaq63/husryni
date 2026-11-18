import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { FIX_SYSTEM_PROMPT, ITEM_SYSTEM_PROMPT, PHOTO_CHECK_SYSTEM_PROMPT, SUMMARY_SYSTEM_PROMPT } from "./prompt";
import {
  FixCheckSchema,
  ItemAnalysisSchema,
  PhotoCheckSchema,
  SummarySchema,
  type FixCheck,
  type ItemAnalysis,
  type PhotoCheck,
  type SummaryOutput,
} from "./schema";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

// AI_* names on purpose, not CLAUDE_*: Claude Code exports CLAUDE_EFFORT to every process it starts
// (terminals included), and a variable already in the environment overrides .env.local.
export const claudeModel = () => process.env.AI_MODEL || "claude-opus-5-5";
/** Fast, low-cost model for high-volume, simple checks (photo usability). */
export const claudeFastModel = () => process.env.AI_FAST_MODEL || "claude-haiku-5-5";
const claudeEffort = (): Effort => {
  const e = (process.env.AI_EFFORT || "high") as Effort;
  return EFFORTS.includes(e) ? e : "high";
};

let client: Anthropic | null = null;
function getClient() {
  // Resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile.
  client ??= new Anthropic();
  return client;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly userMessage: { is: string; en: string },
    readonly retryable = false,
  ) {
    super(message);
  }
}

export interface ImageInput {
  mime: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

export interface ClaudeResult<T> {
  output: T;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

function translateError(err: unknown): never {
  if (err instanceof AiError) throw err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    throw new AiError(err.message, {
      is: "Aðgangur að gervigreindarþjónustu er ekki rétt uppsettur (API-lykill).",
      en: "The AI service credentials are not configured correctly (API key).",
    });
  }
  if (err instanceof Anthropic.RateLimitError) {
    throw new AiError(err.message, { is: "Of mikið álag. Reyndu aftur eftir smá stund.", en: "Too many requests. Try again shortly." }, true);
  }
  if (err instanceof Anthropic.BadRequestError) {
    throw new AiError(err.message, {
      is: "Ekki tókst að greina myndirnar (ógild beiðni). Prófaðu að taka myndirnar aftur.",
      en: "The photos could not be analysed (invalid request). Try retaking them.",
    });
  }
  // APIConnectionError is a subclass of APIError, so check it first.
  if (err instanceof Anthropic.APIConnectionError) {
    throw new AiError(err.message, { is: "Ekki náðist samband við gervigreindarþjónustu.", en: "Could not reach the AI service." }, true);
  }
  if (err instanceof Anthropic.APIError) {
    throw new AiError(err.message, { is: "Villa hjá gervigreindarþjónustu. Reyndu aftur.", en: "The AI service returned an error. Try again." }, true);
  }
  throw err;
}

function checkStop(stopReason: string | null) {
  if (stopReason === "refusal") {
    throw new AiError("model refused", {
      is: "Gervigreindin gat ekki metið þessar myndir. Skoðunarmaður þarf að meta þennan lið.",
      en: "The AI could not assess these photos. An inspector needs to assess this item.",
    });
  }
  if (stopReason === "max_tokens") {
    throw new AiError("output truncated", { is: "Greiningin varð of löng. Reyndu aftur.", en: "The analysis was cut off. Try again." }, true);
  }
}

/** Analyse one checklist item from its photos. */
export async function claudeAnalyzeItem(images: ImageInput[], taskText: string): Promise<ClaudeResult<ItemAnalysis>> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  images.forEach((img, i) => {
    content.push({ type: "text", text: `Photo ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mime, data: img.base64 } });
  });
  content.push({ type: "text", text: taskText });

  try {
    const response = await getClient().beta.messages.parse({
      model: claudeModel(),
      max_tokens: 16000,
      // Opus 5.5 always uses adaptive thinking; effort controls depth.
      output_config: { effort: claudeEffort(), format: betaZodOutputFormat(ItemAnalysisSchema) },
      // If the model declines for policy reasons, let the API retry on its default fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: ITEM_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });
    checkStop(response.stop_reason);
    if (!response.parsed_output) {
      throw new AiError("unparseable output", { is: "Greiningin skilaði ógildu svari. Reyndu aftur.", en: "The analysis returned an invalid answer. Try again." }, true);
    }
    return {
      output: response.parsed_output,
      model: response.model,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  } catch (err) {
    translateError(err);
  }
}

/** Write the report summary from the (reviewed) findings. Text only. */
export async function claudeSummarize(taskText: string): Promise<ClaudeResult<SummaryOutput>> {
  try {
    const response = await getClient().beta.messages.parse({
      model: claudeModel(),
      max_tokens: 8000,
      output_config: { effort: "medium", format: betaZodOutputFormat(SummarySchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: taskText }],
    });
    checkStop(response.stop_reason);
    if (!response.parsed_output) {
      throw new AiError("unparseable output", { is: "Samantekt mistókst.", en: "Summary generation failed." }, true);
    }
    return {
      output: response.parsed_output,
      model: response.model,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  } catch (err) {
    translateError(err);
  }
}

/** Compare BEFORE (inspection) and AFTER (seller) photos of one finding. */
export async function claudeVerifyFix(before: ImageInput[], after: ImageInput[], taskText: string): Promise<ClaudeResult<FixCheck>> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  before.forEach((img, i) => {
    content.push({ type: "text", text: `BEFORE photo ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mime, data: img.base64 } });
  });
  after.forEach((img, i) => {
    content.push({ type: "text", text: `AFTER photo ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mime, data: img.base64 } });
  });
  content.push({ type: "text", text: taskText });

  try {
    const response = await getClient().beta.messages.parse({
      model: claudeModel(),
      max_tokens: 16000,
      output_config: { effort: claudeEffort(), format: betaZodOutputFormat(FixCheckSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: FIX_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });
    checkStop(response.stop_reason);
    if (!response.parsed_output) {
      throw new AiError("unparseable output", { is: "Samanburður skilaði ógildu svari. Reyndu aftur.", en: "The comparison returned an invalid answer. Try again." }, true);
    }
    return {
      output: response.parsed_output,
      model: response.model,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  } catch (err) {
    translateError(err);
  }
}

/**
 * Instant usability check of one photo with the fast model. Returns null when the
 * check can't be completed (refusal, truncation) so the caller simply skips it.
 */
export async function claudeCheckPhoto(img: ImageInput, taskText: string): Promise<ClaudeResult<PhotoCheck> | null> {
  try {
    const response = await getClient().messages.parse({
      model: claudeFastModel(),
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(PhotoCheckSchema) },
      system: [{ type: "text", text: PHOTO_CHECK_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: img.mime, data: img.base64 } },
            { type: "text", text: taskText },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens" || !response.parsed_output) return null;
    return {
      output: response.parsed_output,
      model: response.model,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  } catch (err) {
    translateError(err);
  }
}
