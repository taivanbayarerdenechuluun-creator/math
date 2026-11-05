import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { loadStats } from "@/lib/awards";
import { ACHIEVEMENTS, levelOf } from "@/lib/gamification";
import { AchievementsView } from "@/components/dashboard/AchievementsView";

export const metadata: Metadata = { title: "Achievements", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [stats, owned, fresh] = await Promise.all([
    loadStats(user.id),
    db.userAchievement.findMany({ where: { userId: user.id }, include: { achievement: { select: { code: true } } } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { xp: true } }),
  ]);
  const unlockedAt = new Map(owned.map((o) => [o.achievement.code, o.unlockedAt.toISOString()]));
  const items = ACHIEVEMENTS.map((a) => ({
    code: a.code, xp: a.xp, name: a.name, desc: a.desc,
    unlockedAt: unlockedAt.get(a.code) ?? null,
    progress: a.progress(stats),
  }));
  return <AchievementsView items={items} level={levelOf(fresh.xp)} />;
}
