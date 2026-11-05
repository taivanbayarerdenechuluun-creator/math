/**
 * Scoring module. Pure functions, no I/O.
 *
 * Concepts kept separate (see docs/SCORING.md):
 *  - Raw score ............ correct / total
 *  - Cognitive performance . difficulty-weighted accuracy, 0–100 (Σ w·correct / Σ w, w = difficulty 1–5).
 *                           Hard items count more, so a path through easy items cannot equal a path
 *                           through hard ones. Unanswered served items count as incorrect at their own
 *                           difficulty; items never reached (early submit) count as incorrect at weight 1.
 *  - Percentile / IQ ...... NOT computed. They need a validated norm sample, which does not exist yet.
 */
export const UNSERVED_WEIGHT = 1;
/** Bump when the scoring formula changes; leaderboards only rank results with the same version. */
export const SCORING_VERSION = 1;

export type ScoreItem = {
  category: string;
  difficulty: number;
  /** null = unanswered */
  correct: boolean | null;
};

export type CategoryScore = { category: string; total: number; correct: number; performance: number };

export type Score = {
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
  performance: number;
  categories: CategoryScore[];
};

const pct = (n: number) => Math.round(n * 10) / 10;

export function score(items: ScoreItem[], expectedTotal: number = items.length): Score {
  const total = Math.max(expectedTotal, items.length);
  const correct = items.filter((i) => i.correct === true).length;
  const incorrect = items.filter((i) => i.correct === false).length;
  const unanswered = total - correct - incorrect;

  const unserved = total - items.length;
  const wSum = items.reduce((a, i) => a + i.difficulty, 0) + unserved * UNSERVED_WEIGHT;
  const wCorrect = items.reduce((a, i) => a + (i.correct ? i.difficulty : 0), 0);

  const byCat = new Map<string, ScoreItem[]>();
  for (const i of items) byCat.set(i.category, [...(byCat.get(i.category) ?? []), i]);
  const categories: CategoryScore[] = [...byCat.entries()].map(([category, list]) => {
    const w = list.reduce((a, i) => a + i.difficulty, 0);
    const wc = list.reduce((a, i) => a + (i.correct ? i.difficulty : 0), 0);
    return {
      category,
      total: list.length,
      correct: list.filter((i) => i.correct).length,
      performance: pct((wc / w) * 100),
    };
  });

  return {
    total,
    correct,
    incorrect,
    unanswered,
    accuracy: total ? pct((correct / total) * 100) : 0,
    performance: wSum ? pct((wCorrect / wSum) * 100) : 0,
    categories,
  };
}
