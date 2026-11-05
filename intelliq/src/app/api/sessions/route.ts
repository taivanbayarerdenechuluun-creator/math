import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isMaintenance } from "@/lib/guard";
import { ensureGuestId, expireIfDue, loadOwnedSession, startSession } from "@/lib/sessions";

const body = z.object({ slug: z.string().min(1).max(80) });

/** Start a session, or resume the caller's unfinished one for the same assessment. */
export async function POST(req: Request) {
  if (!rateLimit(`sess:${clientIp(req)}`, 30, 60_000 * 10))
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const assessment = await db.assessment.findFirst({ where: { slug: parsed.data.slug, active: true } });
  if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });

  const user = await getCurrentUser();
  if ((await isMaintenance()) && user?.role.name !== "ADMIN")
    return NextResponse.json({ error: "INTELLIQ is under maintenance. Please try again shortly." }, { status: 503 });
  const guestId = user ? null : await ensureGuestId();

  const existing = await db.assessmentSession.findFirst({
    where: { assessmentId: assessment.id, status: "IN_PROGRESS", ...(user ? { userId: user.id } : { userId: null, guestToken: guestId }) },
    orderBy: { startedAt: "desc" },
  });
  if (existing) {
    const owned = await loadOwnedSession(existing.id);
    if (owned && !(await expireIfDue(owned))) return NextResponse.json({ sessionId: existing.id, resumed: true });
  }

  const session = await startSession(assessment.id, user?.id ?? null, guestId);
  return NextResponse.json({ sessionId: session.id, resumed: false });
}
