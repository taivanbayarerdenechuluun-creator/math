import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";

// Constant-time-ish: always run a bcrypt compare so response time doesn't reveal account existence.
const DUMMY = bcrypt.hashSync("intelliq-dummy-password", 12);

export async function POST(req: Request) {
  const ip = clientIp(req);
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid credentials." }, { status: 400 });
  const { email, password } = parsed.data;

  if (!rateLimit(`login:${ip}:${email}`, 8, 60_000 * 10))
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY);
  if (!user || !ok) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  if (user.disabledAt) return NextResponse.json({ error: "This account has been suspended." }, { status: 403 });

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
