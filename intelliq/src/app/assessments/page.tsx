import type { Metadata } from "next";
import { db } from "@/lib/db";
import { AssessmentsView } from "@/components/assessments/Views";

export const metadata: Metadata = { title: "Assessments", description: "Adaptive cognitive assessments across seven domains." };
export const dynamic = "force-dynamic";

export default async function Page() {
  const items = await db.assessment.findMany({
    where: { active: true },
    orderBy: [{ questionCount: "desc" }],
    select: { slug: true, titleEn: true, titleMn: true, descEn: true, descMn: true, questionCount: true, durationSec: true },
  });
  return <AssessmentsView items={items} />;
}
