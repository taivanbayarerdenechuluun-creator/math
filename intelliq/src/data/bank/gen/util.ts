import { L, shuffle, type Opt, type QDef } from "../types";

/**
 * Shared helpers for the generated part of the bank (see ./index.ts). Every generator is a pure function of a seeded
 * PRNG, so the generated bank is identical on every run and every machine.
 */
export type R = () => number;
export type Diff = QDef["diff"];
export const DIFFS: Diff[] = [1, 2, 3, 4, 5];

export const int = (r: R, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
export const pick = <T,>(r: R, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
export const spaced = (s: string) => s.split("").join(" ");

/** Identity of a question for de-duplication: same prompt, figures, stimulus and answer = same question. */
export const identity = (q: QDef) => JSON.stringify([q.prompt, q.stem, q.stimulus, q.right]);

/** Calls `make` until `count` distinct questions exist (bounded, so a bad generator fails loudly instead of hanging). */
export function collect(count: number, seen: Set<string>, make: () => QDef | null, label: string): QDef[] {
  const out: QDef[] = [];
  for (let guard = 0; out.length < count && guard < count * 600; guard++) {
    const q = make();
    if (!q) continue;
    const k = identity(q);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(q);
  }
  if (out.length < count) throw new Error(`${label}: only ${out.length} of ${count} distinct questions could be generated`);
  return out;
}

/**
 * Three distinct wrong integers for `value`. `traps` (typical mistakes) come first, then neighbours of the value.
 * Returns null when fewer than three exist.
 */
export function wrongNumbers(r: R, value: number, traps: number[] = [], min = 0): number[] | null {
  const ok = (v: number, seen: Set<number>) => Number.isInteger(v) && v >= min && v !== value && !seen.has(v);
  const out: number[] = [];
  const seen = new Set<number>();
  for (const t of traps) if (ok(t, seen) && out.length < 3) { out.push(t); seen.add(t); }
  const near = shuffle([value + 1, value - 1, value + 2, value - 2, value + 10, value - 10, value + 5, value - 5, value * 2, Math.floor(value / 2)], r);
  for (const v of near) if (ok(v, seen) && out.length < 3) { out.push(v); seen.add(v); }
  return out.length === 3 ? out : null;
}

export const opts = (labels: (string | number)[]): Opt[] => labels.map((x) => L(String(x)));
