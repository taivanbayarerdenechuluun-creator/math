import { db } from "@/lib/db";
import { Panel } from "@/components/admin/AdminShell";
import { AssessmentManager, type AssessmentRow, type PoolQuestion } from "@/components/admin/AssessmentManager";
import { parseWeights } from "@/lib/engine";

export default async function Page() {
  const [assessments, categories, results, poolRows] = await Promise.all([
    db.assessment.findMany({ orderBy: [{ questionCount: "desc" }, { slug: "asc" }], include: { _count: { select: { sessions: true } }, questions: { select: { questionId: true } } } }),
    db.category.findMany({ orderBy: { slug: "asc" }, select: { slug: true, nameEn: true } }),
    db.assessmentResult.findMany({
      orderBy: { createdAt: "desc" }, take: 20,
      include: { user: { select: { name: true, email: true } }, session: { select: { assessment: { select: { titleEn: true } } } } },
    }),
    db.question.findMany({ where: { active: true, origin: { not: "daily" } }, orderBy: [{ category: { slug: "asc" } }, { difficulty: "asc" }], select: { id: true, prompt: true, difficulty: true, category: { select: { slug: true } } } }),
  ]);
  const questions: PoolQuestion[] = poolRows.map((q) => ({ id: q.id, prompt: q.prompt, category: q.category.slug, difficulty: q.difficulty }));
  const rows: AssessmentRow[] = assessments.map((a) => ({
    id: a.id, slug: a.slug, titleEn: a.titleEn, titleMn: a.titleMn, descEn: a.descEn, descMn: a.descMn, questionCount: a.questionCount,
    durationSec: a.durationSec, adaptive: a.adaptive, categorySlugs: a.categorySlugs ? a.categorySlugs.split(",") : [], active: a.active, version: a.version, sessions: a._count.sessions,
    difficultyMin: a.difficultyMin, difficultyMax: a.difficultyMax, categoryWeights: parseWeights(a.categoryWeights), questionIds: a.questions.map((x) => x.questionId),
  }));
  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Assessments</h1>
      <AssessmentManager rows={rows} categories={categories} questions={questions} />
      <Panel title="Latest results">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs text-muted"><th className="font-normal">When</th><th className="font-normal">Assessment</th><th className="font-normal">Taker</th><th className="font-normal">Score</th><th className="font-normal">Correct</th><th className="font-normal">v</th></tr></thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="py-2 text-muted">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  <td>{r.session.assessment.titleEn}</td>
                  <td>{r.user ? `${r.user.name} (${r.user.email})` : <span className="text-muted">guest</span>}</td>
                  <td className="font-semibold">{r.performanceScore}</td><td className="text-muted">{r.correct}/{r.total}</td><td className="text-muted">{r.assessmentVersion}</td>
                </tr>
              ))}
              {!results.length && <tr><td colSpan={6} className="py-6 text-center text-muted">No results yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
