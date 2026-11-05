import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { userForMutation } from "@/lib/guard";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendMail, appUrl } from "@/lib/mailer";
import { mailLang, verificationMail } from "@/lib/mail-templates";

const body = z.object({ lang: z.enum(["en", "mn"]).optional() });

/** Sends a fresh verification link to the signed-in user's own address (the previous link stops working). */
export async function POST(req: Request) {
  const g = await userForMutation(req);
  if ("res" in g) return g.res;
  const { user } = g;
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, already: true });

  if (!rateLimit(`resend:${user.id}`, 3, 10 * 60_000) || !rateLimit(`resend-ip:${clientIp(req)}`, 10, 60 * 60_000))
    return NextResponse.json({ error: "Too many requests. Please wait a few minutes before asking for another email." }, { status: 429 });

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  const prefs = await db.userPreference.findUnique({ where: { userId: user.id }, select: { language: true } });
  const verifyToken = randomBytes(24).toString("hex");
  await db.user.update({ where: { id: user.id }, data: { verifyToken } });

  const mail = verificationMail(mailLang(parsed.success ? parsed.data.lang : undefined, prefs?.language), { name: user.name, url: `${appUrl()}/api/auth/verify?token=${verifyToken}` });
  const sent = await sendMail({ to: user.email, ...mail });
  if (!sent.ok) return NextResponse.json({ error: "We could not send the email right now. Please try again later." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
