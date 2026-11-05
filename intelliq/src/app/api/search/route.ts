import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { containsCI } from "@/lib/db-compat";
import { getCurrentUser } from "@/lib/session";
import { ACHIEVEMENTS } from "@/lib/gamification";
import { clientIp, rateLimit } from "@/lib/rate-limit";

type Hit = { type: "page" | "assessment" | "achievement" | "result"; title: string; sub?: string; href: string };

const PAGES: { title: string; href: string; keys: string }[] = [
  { title: "Assessments", href: "/assessments", keys: "assessments tests тест" },
  { title: "Daily challenge", href: "/daily", keys: "daily challenge сорилт" },
  { title: "Leaderboard", href: "/leaderboard", keys: "leaderboard ranking тэргүүлэгч" },
  { title: "Dashboard", href: "/dashboard", keys: "dashboard home хяналт" },
  { title: "Achievements", href: "/achievements", keys: "achievements badges амжилт" },
  { title: "History & progress", href: "/history", keys: "history progress trends түүх" },
  { title: "Settings", href: "/settings", keys: "settings profile privacy delete account тохиргоо" },
];

export async function GET(req: Request) {
  if (!rateLimit(`search:${clientIp(req)}`, 60, 60_000)) return NextResponse.json({ hits: [] }, { status: 429 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60).toLowerCase();
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const hits: Hit[] = PAGES.filter((p) => (p.title + " " + p.keys).toLowerCase().includes(q)).map((p) => ({ type: "page", title: p.title, href: p.href }));
  const assessments = await db.assessment.findMany({ where: { active: true, OR: [{ titleEn: containsCI(q) }, { titleMn: containsCI(q) }, { descEn: containsCI(q) }] }, take: 6, select: { slug: true, titleEn: true, questionCount: true } });
  hits.push(...assessments.map((a) => ({ type: "assessment" as const, title: a.titleEn, sub: `${a.questionCount} questions`, href: `/assessments/${a.slug}` })));
  hits.push(...ACHIEVEMENTS.filter((a) => (a.name.en + a.name.mn + a.desc.en).toLowerCase().includes(q)).slice(0, 3).map((a) => ({ type: "achievement" as const, title: a.name.en, sub: a.desc.en, href: "/achievements" })));

  const user = await getCurrentUser();
  if (user) {
    const results = await db.assessmentResult.findMany({ where: { userId: user.id, session: { assessment: { titleEn: containsCI(q) } } }, orderBy: { createdAt: "desc" }, take: 3, include: { session: { select: { assessment: { select: { titleEn: true } } } } } });
    hits.push(...results.map((r) => ({ type: "result" as const, title: `${r.session.assessment.titleEn} result`, sub: `${r.createdAt.toISOString().slice(0, 10)} · ${r.performanceScore}`, href: `/results/${r.id}` })));
  }
  return NextResponse.json({ hits: hits.slice(0, 12) });
}
