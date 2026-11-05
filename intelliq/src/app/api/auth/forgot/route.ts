import { after, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { db } from "@/lib/db";
import { forgotSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendMail, appUrl } from "@/lib/mailer";
import { mailLang, resetMail } from "@/lib/mail-templates";

const RESET_MINUTES = 60;

export async function POST(req: Request) {
  if (!rateLimit(`forgot:${clientIp(req)}`, 5, 60_000 * 15))
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  const parsed = forgotSchema.safeParse(await req.json().catch(() => null));
  // Same response either way so account existence isn't revealed.
  const generic = NextResponse.json({ ok: true });
  if (!parsed.success) return generic;

  const user = await db.user.findUnique({ where: { email: parsed.data.email }, include: { preferences: { select: { language: true } } } });
  if (!user) return generic;

  const token = randomBytes(32).toString("hex");
  await db.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: createHash("sha256").update(token).digest("hex"),
      resetTokenExpiry: new Date(Date.now() + RESET_MINUTES * 60 * 1000),
    },
  });
  const mail = resetMail(mailLang(parsed.data.lang, user.preferences?.language), { name: user.name, url: `${appUrl()}/reset-password?token=${token}`, validMinutes: RESET_MINUTES });
  // Sent after the response: an SMTP round trip would otherwise reveal that the account exists.
  after(() => sendMail({ to: user.email, ...mail }));
  return generic;
}
