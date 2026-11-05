import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { DailyRunner } from "@/components/daily/DailyRunner";

export const metadata: Metadata = { title: "Daily challenge", description: "Five short cognitive questions every day." };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  const history = user
    ? (await db.challengeAttempt.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 14, include: { challenge: { select: { date: true } } } })).map((a) => ({ date: a.challenge.date, correct: a.correct, total: a.total, xp: a.xpAwarded }))
    : [];
  return <DailyRunner history={history} />;
}
