import "server-only";
import type { L10n } from "../types";

export type ErrorBody = { error: L10n };

export function fail(status: number, message: L10n | string): Response {
  const error = typeof message === "string" ? { is: message, en: message } : message;
  return Response.json({ error } satisfies ErrorBody, { status });
}

export const NOT_FOUND: L10n = { is: "Fannst ekki.", en: "Not found." };
export const LOCKED: L10n = {
  is: "Ekki er hægt að breyta skoðun á þessu stigi.",
  en: "This inspection can no longer be changed.",
};
export const UNAUTHORIZED: L10n = { is: "Innskráning skoðunarmanns þarf.", en: "Inspector sign-in required." };

/** Parse a JSON body; returns null on malformed JSON. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
