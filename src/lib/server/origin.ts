import "server-only";
import { headers } from "next/headers";

/** Scheme and host of the current request, for absolute links printed on reports (e.g. verification). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "";
  const local = host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("[::1]");
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
  return `${proto}://${host}`;
}
