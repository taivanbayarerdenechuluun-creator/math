import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { awardForChallenge, weeklyProgress, unlockedBy } from "@/lib/awards";
import { getOrCreateChallenge, publicQuestions } from "@/lib/daily";
import { activeStreak, utcDay } from "@/lib/gamification";
import { isMaintenance, userForMutation } from "@/lib/guard";

/** Solution review for an attempt. Only called after the user has attempted (or can never reveal answers earlier). */
async function reviewFor(questionIds: string, detail: Record<string, { optionId: string | null; correct: boolean }>) {
  const ids = questionIds.split(",");
  const rows = await db.question.findMany({ where: { id: { in: ids } }, include: { options: true } });
  return ids.map((id) => {
    const q = rows.find((r) => r.id === id)!;
    return { questionId: id, correctOptionId: q.options.find((o) => o.isCorrect)!.id, chosenOptionId: detail[id]?.optionId ?? null, correct: !!detail[id]?.correct, explanation: q.explanation, explanationMn: q.explanationMn };
  });
}

export async function GET() {
  const user = await getCurrentUser();
  const day = utcDay();
  const challenge = await getOrCreateChallenge(day);
  const questions = await publicQuestions(challenge.questionIds);
  const out: Record<string, unknown> = { date: day, questions, signedIn: !!user, attempt: null, weekly: null, streak: 0 };

  if (user) {
    const [attempt, streak, weekly] = await Promise.all([
      db.challengeAttempt.findUnique({ where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } } }),
      db.userStreak.findUnique({ where: { userId: user.id } }),
      weeklyProgress(user.id),
    ]);
    out.weekly = weekly;
    out.streak = streak ? activeStreak(streak, day) : 0;
    if (attempt) {
      out.attempt = {
        correct: attempt.correct, total: attempt.total, xp: attempt.xpAwarded,
        review: await reviewFor(challenge.questionIds, attempt.detail ? JSON.parse(attempt.detail) : {}),
      };
    }
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}

const body = z.object({ answers: z.record(z.string().max(40), z.string().max(40).nullable()) });

export async function POST(req: Request) {
  const g = await userForMutation(req);
  if ("res" in g) return g.res;
  if (await isMaintenance()) return NextResponse.json({ error: "The site is under maintenance." }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const challenge = await getOrCreateChallenge(utcDay());
  const ids = challenge.questionIds.split(",").filter(Boolean);
  const rows = await db.question.findMany({ where: { id: { in: ids } }, include: { options: true } });

  const detail: Record<string, { optionId: string | null; correct: boolean }> = {};
  let correct = 0;
  for (const id of ids) {
    const q = rows.find((r) => r.id === id)!;
    const pick = parsed.data.answers[id] ?? null;
    if (pick && !q.options.some((o) => o.id === pick)) return NextResponse.json({ error: "Invalid option." }, { status: 400 });
    const ok = !!pick && !!q.options.find((o) => o.id === pick)?.isCorrect;
    if (ok) correct++;
    detail[id] = { optionId: pick, correct: ok };
  }

  let attempt;
  try {
    attempt = await db.challengeAttempt.create({ data: { challengeId: challenge.id, userId: g.user.id, correct, total: ids.length, detail: JSON.stringify(detail) } });
  } catch {
    return NextResponse.json({ error: "You already completed today's challenge." }, { status: 409 });
  }
  const award = await awardForChallenge(g.user.id, attempt.id, correct);
  await db.challengeAttempt.update({ where: { id: attempt.id }, data: { xpAwarded: award.xp + award.bonus } });
  const unlocked = await unlockedBy(g.user.id, attempt.id);
  return NextResponse.json({
    correct, total: ids.length, xp: award.xp, bonus: award.bonus, streak: award.streak.current,
    unlocked: unlocked.map((a) => ({ code: a.code, name: a.name, xp: a.xp })),
    review: await reviewFor(challenge.questionIds, detail),
  });
}
