import "server-only";
import { db } from "./db";
import { ACHIEVEMENTS, activeStreak, levelOf, utcDay, type AchDef } from "./gamification";
import { loadStats, weeklyProgress } from "./awards";
import { tipsFor, weakestDomain, type Bi } from "./feedback";

export type Recommendation = { slug: string; titleEn: string; titleMn: string; reason: Bi };

export type DashboardData = {
  name: string;
  level: ReturnType<typeof levelOf>;
  streak: number;
  longestStreak: number;
  challengeDoneToday: boolean;
  weekly: Awaited<ReturnType<typeof weeklyProgress>>;
  latest: null | {
    id: string; titleEn: string; titleMn: string; performance: number; accuracy: number; total: number; correct: number; createdAt: string;
    categories: { slug: string; total: number; correct: number; performance: number; prev: null }[];
  };
  history: { id: string; titleEn: string; titleMn: string; performance: number; accuracy: number; createdAt: string }[];
  historyCount: number;
  activity: { id: string; kind: string; label: Bi; amount: number; at: string }[];
  achievements: { earned: number; total: number; recent: { code: string; at: string }[]; next: { code: string; current: number; target: number } | null };
  recommendations: Recommendation[];
  suggestions: Bi[];
  bookmarks: { slug: string; titleEn: string; titleMn: string }[];
  unread: number;
};

const REASON: Record<string, Bi> = { result: { en: "Completed an assessment", mn: "Тест гүйцэтгэсэн" }, daily: { en: "Completed the daily challenge", mn: "Өдрийн даалгавар гүйцэтгэсэн" } };
function reasonLabel(r: string): Bi {
  if (r.startsWith("achievement:")) {
    const a = ACHIEVEMENTS.find((x) => x.code === r.slice(12));
    return a ? { en: `Unlocked: ${a.name.en}`, mn: `Нээсэн: ${a.name.mn}` } : { en: r, mn: r };
  }
  if (r.startsWith("weekly:")) return { en: "Weekly challenge bonus", mn: "7 хоногийн даалгаврын урамшуулал" };
  return REASON[r] ?? { en: r, mn: r };
}

export async function loadDashboard(userId: string, name: string, xp: number): Promise<DashboardData> {
  const [results, historyCount, streakRow, todayAttempt, weekly, owned, stats, bookmarks, assessments, xpTx, unread] = await Promise.all([
    db.assessmentResult.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, take: 6,
      include: { session: { select: { assessment: { select: { slug: true, titleEn: true, titleMn: true } } } }, categories: { include: { category: { select: { slug: true } } } } },
    }),
    db.assessmentResult.count({ where: { userId } }),
    db.userStreak.findUnique({ where: { userId } }),
    db.challengeAttempt.findFirst({ where: { userId, challenge: { date: utcDay() } } }),
    weeklyProgress(userId),
    db.userAchievement.findMany({ where: { userId }, orderBy: { unlockedAt: "desc" }, include: { achievement: { select: { code: true } } } }),
    loadStats(userId),
    db.bookmark.findMany({ where: { userId }, include: { assessment: { select: { slug: true, titleEn: true, titleMn: true } } }, orderBy: { createdAt: "desc" } }),
    db.assessment.findMany({ where: { active: true }, select: { id: true, slug: true, titleEn: true, titleMn: true, questionCount: true } }),
    db.xPTransaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);

  const latestRow = results[0];
  const latestCats = latestRow?.categories.map((c) => ({ slug: c.category.slug, total: c.total, correct: c.correct, performance: c.performance, prev: null })) ?? [];
  const weak = weakestDomain(latestCats);

  // Recommendations come from actual data: weakest domain, then what you have not tried / not done lately.
  const recs: Recommendation[] = [];
  const bySlug = new Map(assessments.map((a) => [a.slug, a]));
  if (weak) {
    const a = bySlug.get(`${weak.slug}-focus`);
    if (a) recs.push({ slug: a.slug, titleEn: a.titleEn, titleMn: a.titleMn, reason: { en: `Your weakest domain in the latest attempt (${Math.round(weak.performance)}%).`, mn: `Сүүлийн оролдлогын хамгийн сул чадвар (${Math.round(weak.performance)}%).` } });
  }
  const lastTaken = new Map<string, number>();
  for (const r of results) lastTaken.set(r.session.assessment.slug, Math.max(lastTaken.get(r.session.assessment.slug) ?? 0, r.createdAt.getTime()));
  const order = ["full-battery", "reasoning-core", "memory-speed", "quick-check"];
  const untried = order.map((s) => bySlug.get(s)).filter((a): a is NonNullable<typeof a> => !!a && !lastTaken.has(a.slug));
  for (const a of untried.slice(0, 2)) if (!recs.some((r) => r.slug === a.slug)) recs.push({ slug: a.slug, titleEn: a.titleEn, titleMn: a.titleMn, reason: { en: "You have not taken this one yet.", mn: "Та үүнийг хараахан өгөөгүй байна." } });
  if (recs.length < 3) {
    const oldest = [...assessments].filter((a) => lastTaken.has(a.slug) && !recs.some((r) => r.slug === a.slug)).sort((a, b) => lastTaken.get(a.slug)! - lastTaken.get(b.slug)!)[0];
    if (oldest) recs.push({ slug: oldest.slug, titleEn: oldest.titleEn, titleMn: oldest.titleMn, reason: { en: "Not taken for the longest time.", mn: "Хамгийн удаан өгөөгүй тест." } });
  }

  const unearned = ACHIEVEMENTS.filter((a) => !owned.some((o) => o.achievement.code === a.code));
  const nextAch = unearned
    .map((a: AchDef) => ({ code: a.code, ...a.progress(stats) }))
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];

  return {
    name,
    level: levelOf(xp),
    streak: streakRow ? activeStreak(streakRow, utcDay()) : 0,
    longestStreak: streakRow?.longest ?? 0,
    challengeDoneToday: !!todayAttempt,
    weekly,
    latest: latestRow
      ? { id: latestRow.id, titleEn: latestRow.session.assessment.titleEn, titleMn: latestRow.session.assessment.titleMn, performance: latestRow.performanceScore, accuracy: latestRow.accuracy, total: latestRow.total, correct: latestRow.correct, createdAt: latestRow.createdAt.toISOString(), categories: latestCats }
      : null,
    history: results.slice(0, 5).map((r) => ({ id: r.id, titleEn: r.session.assessment.titleEn, titleMn: r.session.assessment.titleMn, performance: r.performanceScore, accuracy: r.accuracy, createdAt: r.createdAt.toISOString() })),
    historyCount,
    activity: xpTx.map((t) => ({ id: t.id, kind: t.reason.split(":")[0], label: reasonLabel(t.reason), amount: t.amount, at: t.createdAt.toISOString() })),
    achievements: { earned: owned.length, total: ACHIEVEMENTS.length, recent: owned.slice(0, 3).map((o) => ({ code: o.achievement.code, at: o.unlockedAt.toISOString() })), next: nextAch ?? null },
    recommendations: recs.slice(0, 3),
    suggestions: weak ? tipsFor(weak.slug) : [],
    bookmarks: bookmarks.map((b) => b.assessment),
    unread,
  };
}
