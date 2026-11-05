import "server-only";
import { db, isUniqueViolation } from "./db";
import { notify } from "./guard";
import {
  ACHIEVEMENTS, earnedCodes, isConsistent, isoWeekKey, nextStreak, utcDay, xpForChallenge, xpForResult,
  WEEKLY_BONUS_XP, WEEKLY_TARGET, type AchDef, type AchStats,
} from "./gamification";

export async function ensureAchievements() {
  for (const a of ACHIEVEMENTS) {
    const data = { nameEn: a.name.en, nameMn: a.name.mn, descEn: a.desc.en, descMn: a.desc.mn, xpReward: a.xp };
    await db.achievement.upsert({ where: { code: a.code }, update: data, create: { code: a.code, ...data } });
  }
}

export async function loadStats(userId: string): Promise<AchStats> {
  const [results, streak, challengesDone] = await Promise.all([
    db.assessmentResult.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { accuracy: true, total: true, performanceScore: true, session: { select: { assessmentId: true } }, categories: { select: { total: true, performance: true, category: { select: { slug: true } } } } },
    }),
    db.userStreak.findUnique({ where: { userId } }),
    db.challengeAttempt.count({ where: { userId } }),
  ]);

  const bestByCat: Record<string, number> = {};
  const tried = new Set<string>();
  for (const r of results) {
    for (const c of r.categories) {
      if (c.total >= 1) tried.add(c.category.slug);
      if (c.total >= 2) bestByCat[c.category.slug] = Math.max(bestByCat[c.category.slug] ?? 0, c.performance);
    }
  }
  const byAssessment = new Map<string, number[]>();
  for (const r of results) byAssessment.set(r.session.assessmentId, [...(byAssessment.get(r.session.assessmentId) ?? []), r.performanceScore]);

  return {
    resultsCount: results.length,
    perfectRuns: results.filter((r) => r.accuracy === 100 && r.total >= 8).length,
    bestByCat,
    consistentRecent: [...byAssessment.values()].some((p) => isConsistent(p.slice(-3))),
    longestStreak: streak?.longest ?? 0,
    challengesDone,
    domainsTried: tried.size,
  };
}

/** Records activity today and returns the updated streak. */
export async function recordActivity(userId: string) {
  const cur = (await db.userStreak.findUnique({ where: { userId } })) ?? { current: 0, longest: 0, lastActiveDate: null };
  const next = nextStreak(cur, utcDay());
  await db.userStreak.upsert({ where: { userId }, update: next, create: { userId, ...next } });
  return next;
}

/**
 * Grants XP at most once per (user, reason, ref): the unique constraint rejects a concurrent duplicate and, because
 * the ledger entry and the balance update are one transaction, the duplicate's balance change is rolled back too.
 * Returns false when this award had already been granted.
 */
async function grantXp(userId: string, amount: number, reason: string, refId: string): Promise<boolean> {
  try {
    await db.$transaction([
      db.xPTransaction.create({ data: { userId, amount, reason, refId } }),
      db.user.update({ where: { id: userId }, data: { xp: { increment: amount } } }),
    ]);
    return true;
  } catch (e) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}

/** Awards any newly satisfied achievements (idempotent) and their XP. */
export async function awardAchievements(userId: string, refId: string): Promise<AchDef[]> {
  await ensureAchievements();
  const earned = new Set(earnedCodes(await loadStats(userId)));
  const rows = await db.achievement.findMany({ where: { code: { in: [...earned] } } });
  const owned = new Set((await db.userAchievement.findMany({ where: { userId }, select: { achievementId: true } })).map((o) => o.achievementId));
  const fresh: AchDef[] = [];
  for (const row of rows) {
    if (owned.has(row.id)) continue;
    try {
      await db.userAchievement.create({ data: { userId, achievementId: row.id, resultId: refId } });
    } catch {
      continue; // lost a race with a concurrent award
    }
    const def = ACHIEVEMENTS.find((a) => a.code === row.code)!;
    if (!(await grantXp(userId, def.xp, `achievement:${def.code}`, row.id))) continue;
    await notify(userId, `Achievement unlocked: ${def.name.en}`, `${def.desc.en} (+${def.xp} XP)`, "/achievements", { title: `Амжилт нээгдлээ: ${def.name.mn}`, body: `${def.desc.mn} (+${def.xp} XP)` });
    fresh.push(def);
  }
  return fresh;
}

/** Called after an assessment is finalized. Safe to call repeatedly. */
export async function awardForResult(resultId: string) {
  const result = await db.assessmentResult.findUnique({ where: { id: resultId } });
  if (!result?.userId) return;
  const done = await db.xPTransaction.findFirst({ where: { userId: result.userId, reason: "result", refId: resultId } });
  if (done) return;
  const xp = xpForResult(result.performanceScore);
  // A concurrent request that already granted this result's XP has also done the rest; do not repeat it.
  if (!(await grantXp(result.userId, xp, "result", resultId))) return;
  await recordActivity(result.userId);
  await awardAchievements(result.userId, resultId);
  await notify(result.userId, "Assessment complete", `You earned ${xp} XP. Open your results to review feedback.`, `/results/${resultId}`, { title: "Тест дууслаа", body: `Та ${xp} XP авлаа. Үр дүнгээ нээж санал хүсэлтээ үзнэ үү.` });
}

/** Achievements unlocked by a given result or challenge attempt. */
export async function unlockedBy(userId: string, refId: string) {
  const rows = await db.userAchievement.findMany({ where: { userId, resultId: refId }, include: { achievement: true } });
  return rows.map((r) => ACHIEVEMENTS.find((a) => a.code === r.achievement.code)).filter((a): a is AchDef => !!a);
}

export type WeeklyProgress = { week: string; done: number; target: number; claimed: boolean };

export async function weeklyProgress(userId: string, now = new Date()): Promise<WeeklyProgress> {
  const week = isoWeekKey(now);
  const attempts = await db.challengeAttempt.findMany({ where: { userId }, select: { challenge: { select: { date: true } } } });
  const done = attempts.filter((a) => isoWeekKey(new Date(a.challenge.date + "T00:00:00Z")) === week).length;
  const claimed = !!(await db.xPTransaction.findFirst({ where: { userId, reason: `weekly:${week}` } }));
  return { week, done, target: WEEKLY_TARGET, claimed };
}

/** Awards a daily-challenge attempt: XP, streak, weekly bonus, achievements. */
export async function awardForChallenge(userId: string, attemptId: string, correct: number) {
  const xp = xpForChallenge(correct);
  await grantXp(userId, xp, "daily", attemptId);
  const streak = await recordActivity(userId);
  const week = await weeklyProgress(userId);
  let bonus = 0;
  if (week.done >= week.target && !week.claimed) {
    bonus = (await grantXp(userId, WEEKLY_BONUS_XP, `weekly:${week.week}`, week.week)) ? WEEKLY_BONUS_XP : 0;
    if (bonus) await notify(userId, "Weekly challenge complete", `${week.target} daily challenges this week: +${bonus} XP.`, "/daily", { title: "7 хоногийн даалгавар биелэв", body: `Энэ долоо хоногт ${week.target} өдөр тутмын даалгавар: +${bonus} XP.` });
  }
  const unlocked = await awardAchievements(userId, attemptId);
  return { xp, bonus, streak, unlocked };
}
