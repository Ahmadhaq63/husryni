import { cookies } from "next/headers";
import { INSPECTOR_COOKIE } from "@/lib/server/session";

export async function POST() {
  (await cookies()).delete(INSPECTOR_COOKIE);
  return Response.json({ ok: true });
}
