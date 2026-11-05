import { SCORING_VERSION } from "./scoring";

export type Scope = "global" | "weekly" | "monthly";
export const MIN_QUESTIONS = 8; // shorter runs are too noisy to rank

export type Candidate = { userId: string; value: number; accuracy: number; at: number };
export type Ranked = { userId: string; rank: number; value: number; accuracy: number; attempts: number };

export function sinceFor(scope: Scope, now = Date.now()): Date | null {
  const day = 86400000;
  return scope === "weekly" ? new Date(now - 7 * day) : scope === "monthly" ? new Date(now - 30 * day) : null;
}

/** Best result per user; sorted by score, then accuracy, then earlier achievement. Ties share a rank. */
export function rankEntries(cands: Candidate[]): Ranked[] {
  const best = new Map<string, Candidate & { attempts: number }>();
  for (const c of cands) {
    const cur = best.get(c.userId);
    const better = !cur || c.value > cur.value || (c.value === cur.value && (c.accuracy > cur.accuracy || (c.accuracy === cur.accuracy && c.at < cur.at)));
    best.set(c.userId, better ? { ...c, attempts: (cur?.attempts ?? 0) + 1 } : { ...cur!, attempts: cur!.attempts + 1 });
  }
  const sorted = [...best.values()].sort((a, b) => b.value - a.value || b.accuracy - a.accuracy || a.at - b.at || a.userId.localeCompare(b.userId));
  let rank = 0;
  return sorted.map((e, i) => {
    if (i === 0 || e.value !== sorted[i - 1].value || e.accuracy !== sorted[i - 1].accuracy) rank = i + 1;
    return { userId: e.userId, rank, value: e.value, accuracy: e.accuracy, attempts: e.attempts };
  });
}

/** Public display name: first name only, never an email or full name. */
export function displayName(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return (first.slice(0, 20) || "Anonymous");
}

export { SCORING_VERSION };
