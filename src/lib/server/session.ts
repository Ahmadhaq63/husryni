import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { Lang } from "../types";

export const LANG_COOKIE = "lang";
export const INSPECTOR_COOKIE = "husryni_inspector";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return v === "en" ? "en" : "is";
}

const isProd = process.env.NODE_ENV === "production";

/** Prototype-only shared passcode. Replace with real accounts (e.g. Auðkenni / island.is) before launch. */
function passcode(): string {
  return process.env.INSPECTOR_PASSCODE || (isProd ? "" : "demo");
}
function secret(): string {
  return process.env.SESSION_SECRET || (isProd ? "" : "dev-only-session-secret");
}

function token(): string | null {
  const s = secret();
  if (!s || !passcode()) return null;
  return crypto.createHmac("sha256", s).update(`inspector:${passcode()}`).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function checkPasscode(input: string): string | null {
  const p = passcode();
  if (!p || !safeEqual(input, p)) return null;
  return token();
}

export async function isInspector(): Promise<boolean> {
  const t = token();
  const c = (await cookies()).get(INSPECTOR_COOKIE)?.value;
  return !!t && !!c && safeEqual(c, t);
}
