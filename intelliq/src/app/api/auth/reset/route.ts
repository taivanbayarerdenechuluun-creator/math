import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { resetSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(`reset:${clientIp(req)}`, 10, 60_000 * 15))
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  const parsed = resetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const hash = createHash("sha256").update(parsed.data.token).digest("hex");
  const user = await db.user.findFirst({
    where: { resetTokenHash: hash, resetTokenExpiry: { gt: new Date() } },
  });
  if (!user) return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 12), resetTokenHash: null, resetTokenExpiry: null },
  });
  return NextResponse.json({ ok: true });
}
