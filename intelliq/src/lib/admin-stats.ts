import "server-only";
import { db } from "./db";
import { utcDay, addDays } from "./gamification";

export type AdminStats = Awaited<ReturnType<typeof loadAdminStats>>;

const MIN_ANSWERS = 5;

export async function loadAdminStats() {
  const since7 = new Date(Date.now() - 7 * 86400000);
  const today = utcDay();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const since14 = new Date(days[0] + "T00:00:00Z");

  const [users, newUsers, sessions, submitted, results, avgPerf, catAgg, cats, answerAgg, questions, recentSessions, recentAttempts, achAgg, achievements, activeA, activeB, challengeTotal] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: since7 } } }),
    db.assessmentSession.count(),
    db.assessmentSession.count({ where: { status: "SUBMITTED" } }),
    db.assessmentResult.count(),
    db.assessmentResult.aggregate({ _avg: { performanceScore: true, accuracy: true } }),
    db.categoryResult.groupBy({ by: ["categoryId"], _avg: { performance: true }, _count: true }),
    db.category.findMany({ select: { id: true, slug: true, nameEn: true } }),
    db.userAnswer.groupBy({ by: ["questionId", "isCorrect"], where: { optionId: { not: null } }, _count: true }),
    db.question.findMany({ select: { id: true, prompt: true, difficulty: true, active: true, category: { select: { slug: true } } } }),
    db.assessmentSession.findMany({ where: { startedAt: { gte: since14 } }, select: { startedAt: true } }),
    db.challengeAttempt.findMany({ where: { createdAt: { gte: since14 } }, select: { createdAt: true } }),
    db.userAchievement.groupBy({ by: ["achievementId"], _count: true }),
    db.achievement.findMany({ select: { id: true, nameEn: true, code: true } }),
    db.assessmentSession.findMany({ where: { startedAt: { gte: since7 }, userId: { not: null } }, select: { userId: true }, distinct: ["userId"] }),
    db.challengeAttempt.findMany({ where: { createdAt: { gte: since7 } }, select: { userId: true }, distinct: ["userId"] }),
    db.challengeAttempt.count(),
  ]);

  const activeUsers = new Set([...activeA.map((a) => a.userId), ...activeB.map((a) => a.userId)]).size;

  const catName = new Map(cats.map((c) => [c.id, c]));
  const categoryPerformance = catAgg
    .map((c) => ({ slug: catName.get(c.categoryId)!.slug, name: catName.get(c.categoryId)!.nameEn, avg: Math.round((c._avg.performance ?? 0) * 10) / 10, measured: c._count }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const byQ = new Map<string, { right: number; wrong: number }>();
  for (const a of answerAgg) {
    const cur = byQ.get(a.questionId) ?? { right: 0, wrong: 0 };
    if (a.isCorrect) cur.right += a._count;
    else cur.wrong += a._count;
    byQ.set(a.questionId, cur);
  }
  const qInfo = new Map(questions.map((q) => [q.id, q]));
  const questionStats = [...byQ.entries()]
    .map(([id, v]) => ({ id, prompt: qInfo.get(id)?.prompt ?? "(deleted)", category: qInfo.get(id)?.category.slug ?? "", difficulty: qInfo.get(id)?.difficulty ?? 0, answers: v.right + v.wrong, accuracy: Math.round((v.right / (v.right + v.wrong)) * 1000) / 10 }))
    .filter((q) => q.answers >= MIN_ANSWERS);
  const hardest = [...questionStats].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);
  const easiest = [...questionStats].sort((a, b) => b.accuracy - a.accuracy).slice(0, 5);

  const bucket = (rows: { startedAt?: Date; createdAt?: Date }[]) => {
    const m = new Map(days.map((d) => [d, 0]));
    for (const r of rows) {
      const d = (r.startedAt ?? r.createdAt)!.toISOString().slice(0, 10);
      if (m.has(d)) m.set(d, m.get(d)! + 1);
    }
    return m;
  };
  const s = bucket(recentSessions), c = bucket(recentAttempts);
  const engagement = days.map((d) => ({ day: d.slice(5), sessions: s.get(d)!, challenges: c.get(d)! }));

  const achievementStats = achievements.map((a) => ({ code: a.code, name: a.nameEn, unlocked: achAgg.find((x) => x.achievementId === a.id)?._count ?? 0 })).sort((a, b) => b.unlocked - a.unlocked);

  return {
    users, newUsers, activeUsers, sessions, submitted,
    completionRate: sessions ? Math.round((submitted / sessions) * 1000) / 10 : 0,
    results, avgPerformance: Math.round((avgPerf._avg.performanceScore ?? 0) * 10) / 10, avgAccuracy: Math.round((avgPerf._avg.accuracy ?? 0) * 10) / 10,
    categoryPerformance, hardest, easiest, questionsTotal: questions.length, questionsActive: questions.filter((q) => q.active).length,
    answeredTotal: answerAgg.reduce((a, x) => a + x._count, 0), challengeTotal, engagement, achievementStats,
  };
}
