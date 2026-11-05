import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { QuestionEditor, type EditorInitial } from "@/components/admin/QuestionEditor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await db.question.findUnique({
    where: { id },
    include: { category: true, options: { orderBy: { position: "asc" } }, versions: { orderBy: { version: "desc" }, select: { version: true, createdAt: true, authorId: true } } },
  });
  if (!q) notFound();
  const [categories, answers, correct, daily] = await Promise.all([
    db.category.findMany({ orderBy: { slug: "asc" }, select: { slug: true, nameEn: true } }),
    db.userAnswer.count({ where: { questionId: id, optionId: { not: null } } }),
    db.userAnswer.count({ where: { questionId: id, isCorrect: true } }),
    db.dailyChallenge.count({ where: { questionIds: { contains: id } } }),
  ]);
  const inUse = answers > 0 || daily > 0 || (await db.userAnswer.count({ where: { questionId: id } })) > 0;
  const initial: EditorInitial = {
    id: q.id, version: q.version, inUse, answers, accuracy: answers ? Math.round((correct / answers) * 1000) / 10 : null,
    categorySlug: q.category.slug, prompt: q.prompt, difficulty: q.difficulty, explanation: q.explanation, timeLimitSec: q.timeLimitSec,
    promptMn: q.promptMn, explanationMn: q.explanationMn, stimulusMn: q.stimulusMn,
    stimulus: q.stimulus ? JSON.parse(q.stimulus) : null, stimulusSec: q.stimulusSec, figure: q.figure ? JSON.parse(q.figure) : null,
    imageUrl: q.assetUrl, active: q.active,
    options: q.options.map((o) => ({ id: o.id, label: o.label, labelMn: o.labelMn, figure: o.figure ? JSON.parse(o.figure) : null, isCorrect: o.isCorrect })),
    versions: q.versions.map((v) => ({ version: v.version, at: v.createdAt.toISOString() })),
  };
  return <QuestionEditor categories={categories} initial={initial} />;
}
