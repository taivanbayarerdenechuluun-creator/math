import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { DEADLINE_GRACE_MS, expireIfDue, loadOwnedSession, saveAnswer } from "@/lib/sessions";

type Ctx = { params: Promise<{ id: string }> };

const body = z.object({
  questionId: z.string().min(1).max(40),
  optionId: z.string().min(1).max(40).nullable().optional(),
  flagged: z.boolean().optional(),
});

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!rateLimit(`ans:${clientIp(req)}`, 300, 60_000))
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const s = await loadOwnedSession(id);
  if (!s) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (s.status !== "IN_PROGRESS") return NextResponse.json({ error: "Session already submitted.", resultId: s.result?.id ?? null }, { status: 409 });

  const resultId = await expireIfDue(s, DEADLINE_GRACE_MS);
  if (resultId) return NextResponse.json({ error: "Time is up.", expired: true, resultId }, { status: 409 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const r = await saveAnswer(s, parsed.data);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  // Correctness is intentionally NOT returned.
  return NextResponse.json({ ok: true, resolved: r.resolved, expired: r.expired ?? false });
}
