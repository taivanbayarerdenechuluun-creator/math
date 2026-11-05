import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { readGuestId, sessionExpired } from "@/lib/sessions";
import { OverviewView } from "@/components/assessments/Views";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await db.assessment.findFirst({ where: { slug: (await params).slug, active: true } });
  return a ? { title: a.titleEn, description: a.descEn } : {};
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const a = await db.assessment.findFirst({
    where: { slug, active: true },
    select: { id: true, slug: true, titleEn: true, titleMn: true, descEn: true, descMn: true, questionCount: true, durationSec: true, categorySlugs: true },
  });
  if (!a) notFound();

  const slugs = a.categorySlugs ? a.categorySlugs.split(",") : null;
  const categories = await db.category.findMany({
    where: slugs ? { slug: { in: slugs } } : undefined,
    select: { slug: true, nameEn: true, nameMn: true },
  });

  const user = await getCurrentUser();
  const guest = user ? null : await readGuestId();
  const resume =
    user || guest
      ? await db.assessmentSession.findFirst({
          where: { assessmentId: a.id, status: "IN_PROGRESS", ...(user ? { userId: user.id } : { userId: null, guestToken: guest }) },
          select: { id: true, startedAt: true },
        })
      : null;
  const bookmarked = user ? !!(await db.bookmark.findFirst({ where: { userId: user.id, assessmentId: a.id }, select: { id: true } })) : false;
  const expired = resume ? sessionExpired(resume.startedAt, a.durationSec) : false;

  return <OverviewView a={a} categories={categories} resumeId={resume && !expired ? resume.id : null} signedIn={!!user} bookmarked={bookmarked} />;
}
