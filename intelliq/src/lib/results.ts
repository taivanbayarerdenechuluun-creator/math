import "server-only";
import { db } from "./db";
import { getCurrentUser } from "./session";
import { readGuestId } from "./sessions";
import { buildFeedback, CAT_NAMES, type CatStat, type Feedback } from "./feedback";
import type { AiInput } from "./ai";
import { unlockedBy } from "./awards";
import { reactionDelayMs, type Reaction } from "./figures";
import type { Bi as GBi } from "./gamification";

export type ReviewItem = {
  position: number;
  category: string;
  difficulty: number;
  prompt: string;
  promptMn: string | null;
  stem: unknown | null;
  stimulus: { text?: string; fig?: unknown } | null;
  stimulusMn: string | null;
  options: { id: string; label: string; labelMn: string | null; figure: unknown | null; isCorrect: boolean }[];
  chosenId: string | null;
  correct: boolean | null;
  explanation: string;
  explanationMn: string | null;
  /** Reaction items: measured reaction time (null when unanswered or a false start) and the limit. */
  reaction: { ms: number | null; falseStart: boolean; limitMs: number } | null;
};

export type CategoryDetail = CatStat & { prev: number | null };

export type FullResult = {
  id: string;
  reportCode: string;
  titleEn: string;
  titleMn: string;
  assessmentSlug: string;
  total: number; correct: number; incorrect: number; unanswered: number;
  accuracy: number; performance: number; durationSec: number;
  createdAt: string;
  categories: CategoryDetail[];
  previous: { performance: number; createdAt: string } | null;
  feedback: Feedback;
  review: ReviewItem[];
  signedIn: boolean;
  aiInsight: { en?: string; mn?: string } | null;
  aiInput: AiInput;
  unlocked: { code: string; name: GBi; xp: number }[];
  shareToken: string | null;
};

/** Loads a result only if the caller owns it (signed-in owner or the guest browser that took the test). */
export async function loadOwnedResult(id: string): Promise<FullResult | null> {
  const r = await db.assessmentResult.findUnique({
    where: { id },
    include: {
      session: {
        select: {
          guestToken: true,
          assessment: { select: { slug: true, titleEn: true, titleMn: true } },
          answers: {
            orderBy: { position: "asc" },
            include: { question: { include: { category: { select: { slug: true } }, options: { orderBy: { position: "asc" } } } } },
          },
        },
      },
      categories: { include: { category: { select: { slug: true } } } },
      report: { select: { shareToken: true } },
    },
  });
  if (!r) return null;

  const user = await getCurrentUser();
  const guest = await readGuestId();
  const allowed = r.userId ? user?.id === r.userId : !!guest && r.session.guestToken === guest;
  if (!allowed) return null;

  // Previous attempt of the same assessment by the same signed-in user.
  const prevRow = r.userId
    ? await db.assessmentResult.findFirst({
        where: { userId: r.userId, createdAt: { lt: r.createdAt }, id: { not: r.id }, session: { assessmentId: (await db.assessmentSession.findUnique({ where: { id: r.sessionId }, select: { assessmentId: true } }))!.assessmentId } },
        orderBy: { createdAt: "desc" },
        include: { categories: { include: { category: { select: { slug: true } } } } },
      })
    : null;
  const prevBySlug = new Map(prevRow?.categories.map((c) => [c.category.slug, c]) ?? []);

  const answers = r.session.answers;
  const cats: CategoryDetail[] = r.categories
    .map((c) => {
      const slug = c.category.slug;
      const mine = answers.filter((a) => a.question.category.slug === slug);
      const hardest = mine.filter((a) => a.isCorrect).map((a) => a.difficulty);
      const prev = prevBySlug.get(slug);
      return {
        slug,
        total: c.total,
        correct: c.correct,
        performance: c.performance,
        hardestCorrect: hardest.length ? Math.max(...hardest) : null,
        unanswered: mine.filter((a) => !a.optionId).length,
        prev: prev && prev.total >= 2 ? prev.performance : null,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const feedback = buildFeedback({
    performance: r.performanceScore,
    accuracy: r.accuracy,
    total: r.total,
    unanswered: r.unanswered,
    cats,
    previous: prevRow
      ? { performance: prevRow.performanceScore, cats: prevRow.categories.map((c) => ({ slug: c.category.slug, performance: c.performance, total: c.total })) }
      : null,
  });

  const review: ReviewItem[] = answers.map((a) => {
    const isReaction = a.question.kind === "reaction";
    const cfg = isReaction && a.question.figure ? (JSON.parse(a.question.figure) as Reaction) : null;
    const rt = cfg && a.optionId ? a.timeMs - reactionDelayMs(a.id, cfg.minMs, cfg.maxMs) : null;
    return {
      position: a.position,
      category: a.question.category.slug,
      difficulty: a.difficulty,
      prompt: a.question.prompt,
      promptMn: a.question.promptMn,
      stem: a.question.figure ? JSON.parse(a.question.figure) : null,
      stimulus: a.question.stimulus ? JSON.parse(a.question.stimulus) : null,
      stimulusMn: a.question.stimulusMn,
      options: a.question.options.map((o) => ({ id: o.id, label: o.label, labelMn: o.labelMn, figure: o.figure ? JSON.parse(o.figure) : null, isCorrect: o.isCorrect })),
      chosenId: a.optionId,
      // Reaction correctness also depends on timing, so it is the stored verdict, not just the chosen option.
      correct: !a.optionId ? null : isReaction ? a.isCorrect === true : !!a.question.options.find((o) => o.id === a.optionId)?.isCorrect,
      explanation: a.question.explanation,
      explanationMn: a.question.explanationMn,
      reaction: cfg ? { ms: rt !== null && rt >= 0 ? rt : null, falseStart: rt !== null && rt < 0, limitMs: cfg.limitMs } : null,
    };
  });

  return {
    id: r.id,
    reportCode: r.reportCode,
    titleEn: r.session.assessment.titleEn,
    titleMn: r.session.assessment.titleMn,
    assessmentSlug: r.session.assessment.slug,
    total: r.total, correct: r.correct, incorrect: r.incorrect, unanswered: r.unanswered,
    accuracy: r.accuracy, performance: r.performanceScore, durationSec: r.durationSec,
    createdAt: r.createdAt.toISOString(),
    categories: cats,
    previous: prevRow ? { performance: prevRow.performanceScore, createdAt: prevRow.createdAt.toISOString() } : null,
    feedback,
    review,
    signedIn: !!user,
    unlocked: r.userId ? (await unlockedBy(r.userId, r.id)).map((a) => ({ code: a.code, name: a.name, xp: a.xp })) : [],
    shareToken: r.report?.shareToken ?? null,
    aiInsight: r.aiInsight ? JSON.parse(r.aiInsight) : null,
    aiInput: {
      assessment: r.session.assessment.titleEn,
      performance: r.performanceScore,
      accuracy: r.accuracy,
      total: r.total,
      correct: r.correct,
      unanswered: r.unanswered,
      durationSec: r.durationSec,
      categories: cats.map((c) => ({ name: CAT_NAMES[c.slug]?.en ?? c.slug, correct: c.correct, total: c.total, performance: c.performance, hardestCorrect: c.hardestCorrect })),
      feedback: { strengths: feedback.strengths, improvements: feedback.improvements, observations: feedback.observations },
    },
  };
}
