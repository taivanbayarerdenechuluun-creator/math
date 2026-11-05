import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { displayName } from "@/lib/leaderboard";
import { levelOf } from "@/lib/gamification";
import { ProfileCard } from "@/components/history/ProfileCard";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await db.user.findUnique({
    where: { id },
    select: { name: true, xp: true, imageUrl: true, createdAt: true, publicProfile: true, disabledAt: true, achievements: { select: { unlockedAt: true, achievement: { select: { code: true } } }, orderBy: { unlockedAt: "desc" } } },
  });
  // Hidden profiles are indistinguishable from nonexistent ones. Only a first name, level and badges are public.
  if (!u || !u.publicProfile || u.disabledAt) notFound();
  return <ProfileCard id={id} name={displayName(u.name)} level={levelOf(u.xp).level} xp={u.xp} since={u.createdAt.toISOString().slice(0, 7)} hasImage={!!u.imageUrl} badges={u.achievements.map((a) => a.achievement.code)} />;
}
