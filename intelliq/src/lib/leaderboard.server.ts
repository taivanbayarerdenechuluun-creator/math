import "server-only";
import { db } from "./db";
import { levelOf } from "./gamification";
import { displayName, MIN_QUESTIONS, rankEntries, SCORING_VERSION, sinceFor, type Candidate, type Scope } from "./leaderboard";
import { MIN_Q_TO_RANK } from "./feedback";

export type BoardRow = { rank: number; name: string; level: number; value: number; accuracy: number; attempts: number; badges: number; profileId: string | null; me: boolean };
export type Board = { rows: BoardRow[]; me: BoardRow | null; viewerOptedIn: boolean; assessments: { slug: string; titleEn: string; titleMn: string; categories: string[]; version: number }[] };

export async function loadBoard(o: { scope: Scope; slug: string; category: string | null; viewerId: string | null }): Promise<Board> {
  const assessments = (await db.assessment.findMany({ where: { active: true, questionCount: { gte: MIN_QUESTIONS } }, orderBy: { questionCount: "desc" }, select: { slug: true, titleEn: true, titleMn: true, categorySlugs: true, version: true } }))
    .map((a) => ({ version: a.version, slug: a.slug, titleEn: a.titleEn, titleMn: a.titleMn, categories: a.categorySlugs ? a.categorySlugs.split(",") : ["logical", "abstract", "numerical", "verbal", "spatial", "memory", "speed"] }));
  const viewer = o.viewerId ? await db.user.findUnique({ where: { id: o.viewerId }, select: { showOnLeaderboard: true } }) : null;
  const target = assessments.find((a) => a.slug === o.slug);
  if (!target) return { rows: [], me: null, viewerOptedIn: !!viewer?.showOnLeaderboard, assessments };

  const since = sinceFor(o.scope);
  const results = await db.assessmentResult.findMany({
    where: {
      userId: { not: null }, scoringVersion: SCORING_VERSION, assessmentVersion: target.version, total: { gte: MIN_QUESTIONS },
      session: { assessment: { slug: o.slug } }, ...(since ? { createdAt: { gte: since } } : {}),
      user: { showOnLeaderboard: true, disabledAt: null },
    },
    select: { userId: true, performanceScore: true, accuracy: true, createdAt: true, categories: { select: { total: true, performance: true, category: { select: { slug: true } } } } },
  });

  const cands: Candidate[] = [];
  for (const r of results) {
    let value = r.performanceScore;
    if (o.category) {
      const c = r.categories.find((x) => x.category.slug === o.category && x.total >= MIN_Q_TO_RANK);
      if (!c) continue;
      value = c.performance;
    }
    cands.push({ userId: r.userId!, value, accuracy: r.accuracy, at: r.createdAt.getTime() });
  }

  const ranked = rankEntries(cands);
  const users = await db.user.findMany({ where: { id: { in: ranked.map((r) => r.userId) } }, select: { id: true, name: true, xp: true, publicProfile: true, _count: { select: { achievements: true } } } });
  const byId = new Map(users.map((u) => [u.id, u]));
  const toRow = (r: (typeof ranked)[number]): BoardRow => {
    const u = byId.get(r.userId)!;
    return { rank: r.rank, name: displayName(u.name), level: levelOf(u.xp).level, value: r.value, accuracy: r.accuracy, attempts: r.attempts, badges: u._count.achievements, profileId: u.publicProfile ? u.id : null, me: r.userId === o.viewerId };
  };
  const rows = ranked.slice(0, 50).map(toRow);
  const mine = ranked.find((r) => r.userId === o.viewerId);
  return { rows, me: mine ? toRow(mine) : null, viewerOptedIn: !!viewer?.showOnLeaderboard, assessments };
}
