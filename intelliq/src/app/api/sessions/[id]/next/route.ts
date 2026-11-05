import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { DEADLINE_GRACE_MS, advance, expireIfDue, loadOwnedSession } from "@/lib/sessions";

type Ctx = { params: Promise<{ id: string }> };

const body = z.object({ fromQuestionId: z.string().min(1).max(40) });

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!rateLimit(`next:${clientIp(req)}`, 300, 60_000))
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const s = await loadOwnedSession(id);
  if (!s) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (s.status !== "IN_PROGRESS") return NextResponse.json({ error: "Session already submitted.", resultId: s.result?.id ?? null }, { status: 409 });

  const resultId = await expireIfDue(s, DEADLINE_GRACE_MS);
  if (resultId) return NextResponse.json({ error: "Time is up.", expired: true, resultId }, { status: 409 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  return NextResponse.json(await advance(s, parsed.data.fromQuestionId));
}
