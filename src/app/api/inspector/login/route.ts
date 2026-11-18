import { cookies } from "next/headers";
import { z } from "zod";
import { fail, readJson } from "@/lib/server/http";
import { checkPasscode, INSPECTOR_COOKIE } from "@/lib/server/session";

const Body = z.object({ passcode: z.string().min(1).max(200) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail(400, "invalid body");
  const token = checkPasscode(parsed.data.passcode);
  if (!token) return fail(401, { is: "Rangur aðgangskóði.", en: "Wrong passcode." });
  (await cookies()).set(INSPECTOR_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return Response.json({ ok: true });
}
