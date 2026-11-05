/**
 * Adaptive engine. Documented in docs/ADAPTIVE.md.
 *
 * Each cognitive category runs its own "2-up / 1-down" staircase on a 1–5 difficulty scale:
 *  - start at difficulty 3 (clamped into the assessment's allowed range)
 *  - two CONSECUTIVE correct answers in that category  -> difficulty + 1 (streak resets)
 *  - any incorrect answer or skip                      -> difficulty − 1 (streak resets)
 *  - difficulty is clamped to the assessment's range (default 1..5)
 * A 2-up/1-down rule converges on the level where the user answers ~70.7% correctly
 * (Levitt, 1971), so difficulty does not simply climb after every correct answer.
 *
 * Coverage: the next question comes from the category with the lowest served/weight ratio (weights default
 * to 1, i.e. equal shares; an admin can give a domain a larger share), ties broken at random.
 */
export const MIN_DIFF = 1;
export const MAX_DIFF = 5;
export const START_DIFF = 3;

export type CatState = { d: number; s: number };
export type AdaptState = Record<string, CatState>;
export type Range = { min: number; max: number };

export const FULL_RANGE: Range = { min: MIN_DIFF, max: MAX_DIFF };

const clamp = (d: number, r: Range) => Math.max(r.min, Math.min(r.max, d));
export const startDifficulty = (r: Range = FULL_RANGE) => clamp(START_DIFF, r);

export function parseState(raw: string | null | undefined): AdaptState {
  try {
    const v = JSON.parse(raw ?? "{}");
    return v && typeof v === "object" ? (v as AdaptState) : {};
  } catch {
    return {};
  }
}

export function parseWeights(raw: string | null | undefined): Record<string, number> {
  try {
    const v = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(v ?? {}).filter(([, w]) => typeof w === "number" && w > 0)) as Record<string, number>;
  } catch {
    return {};
  }
}

export function applyAnswer(state: AdaptState, category: string, correct: boolean, range: Range = FULL_RANGE): AdaptState {
  const cur = state[category] ?? { d: startDifficulty(range), s: 0 };
  let { d, s } = cur;
  if (correct) {
    s += 1;
    if (s >= 2) {
      d = Math.min(range.max, d + 1);
      s = 0;
    }
  } else {
    d = Math.max(range.min, d - 1);
    s = 0;
  }
  return { ...state, [category]: { d: clamp(d, range), s } };
}

export function targetDifficulty(state: AdaptState, category: string, adaptive = true, range: Range = FULL_RANGE): number {
  return adaptive ? clamp(state[category]?.d ?? startDifficulty(range), range) : startDifficulty(range);
}

/** Category with the lowest served/weight among those that still have unused questions. */
export function pickCategory(
  served: Record<string, number>,
  available: string[],
  rand: () => number = Math.random,
  weights: Record<string, number> = {},
): string | null {
  if (available.length === 0) return null;
  const score = (c: string) => (served[c] ?? 0) / (weights[c] ?? 1);
  const min = Math.min(...available.map(score));
  const tied = available.filter((c) => Math.abs(score(c) - min) < 1e-9);
  return tied[Math.floor(rand() * tied.length)];
}

/**
 * Candidate nearest the target difficulty; ties broken at random.
 *
 * `seen` holds the ids of questions this person met in earlier tests. A question they have not seen is preferred: first
 * one at the best distance from the target, then one a single difficulty step further away. A repeat is served only
 * when everything near the target has been seen, so the bank is used up before anything comes back.
 */
export function pickQuestion<T extends { id?: string; difficulty: number }>(
  candidates: T[],
  target: number,
  rand: () => number = Math.random,
  seen?: ReadonlySet<string>,
): T | null {
  if (candidates.length === 0) return null;
  const dist = (c: T) => Math.abs(c.difficulty - target);
  const best = Math.min(...candidates.map(dist));
  const choose = (list: T[]) => list[Math.floor(rand() * list.length)];
  if (seen && seen.size > 0) {
    const fresh = candidates.filter((c) => !c.id || !seen.has(c.id));
    for (const slack of [0, 1]) {
      const pool = fresh.filter((c) => dist(c) <= best + slack);
      if (pool.length > 0) {
        const nearest = Math.min(...pool.map(dist));
        return choose(pool.filter((c) => dist(c) === nearest));
      }
    }
  }
  return choose(candidates.filter((c) => dist(c) === best));
}
