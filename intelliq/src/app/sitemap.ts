import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const assessments = await db.assessment.findMany({ where: { active: true }, select: { slug: true, createdAt: true } });
  return [
    ...["", "/assessments", "/daily", "/leaderboard", "/login", "/register"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...assessments.map((a) => ({ url: `${base}/assessments/${a.slug}`, lastModified: a.createdAt, changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
