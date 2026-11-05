import { after, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { sendMail, appUrl } from "@/lib/mailer";
import { mailLang, verificationMail } from "@/lib/mail-templates";
import { getSetting, isMaintenance } from "@/lib/guard";

export async function POST(req: Request) {
  if (!rateLimit(`reg:${clientIp(req)}`, 5, 60_000 * 10))
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  if (await isMaintenance()) return NextResponse.json({ error: "INTELLIQ is under maintenance. Please try again shortly." }, { status: 503 });
  if ((await getSetting("registrationOpen")) !== "1") return NextResponse.json({ error: "Registration is currently closed." }, { status: 403 });

  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { name, email, password, lang } = parsed.data;

  if (await db.user.findUnique({ where: { email } }))
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

  const role = await db.role.upsert({ where: { name: "USER" }, update: {}, create: { name: "USER" } });
  const verifyToken = randomBytes(24).toString("hex");
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      roleId: role.id,
      verifyToken,
      preferences: { create: lang ? { language: lang } : {} },
      streak: { create: {} },
    },
  });

  const mail = verificationMail(mailLang(lang), { name, url: `${appUrl()}/api/auth/verify?token=${verifyToken}` });
  after(() => sendMail({ to: email, ...mail })); // the account exists either way; do not make the visitor wait for SMTP
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
