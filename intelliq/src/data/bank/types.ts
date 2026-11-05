import type { Fig, Stem } from "../../lib/figures";

export type Cat = "logical" | "abstract" | "numerical" | "verbal" | "spatial" | "memory" | "speed";

export type Opt = { label?: string; fig?: Fig };

/** Mongolian text for a question. Option labels are only needed where the label has words (numbers/letters are shared). */
export type MnText = { prompt: string; explanation: string; right?: string; wrong?: string[]; stimulus?: string };

export type QDef = {
  cat: Cat;
  diff: 1 | 2 | 3 | 4 | 5;
  prompt: string;
  stem?: Stem;
  stimulus?: { text?: string; fig?: Fig };
  stimulusSec?: number;
  timeLimitSec?: number;
  /** The single correct option. */
  right: Opt;
  /** Distractors. */
  wrong: Opt[];
  /** Keep options in the order given (right goes first unless `order` is set). */
  fixedOrder?: boolean;
  /** For fixedOrder questions: index at which `right` is placed. */
  rightIndex?: number;
  explanation: string;
  mn?: MnText;
  /** Stable identifier assigned when the bank is assembled, e.g. numerical-001. */
  key?: string;
};

/** Deterministic PRNG so the seeded bank is identical on every run. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const L = (label: string): Opt => ({ label });
export const Ls = (...labels: string[]): Opt[] => labels.map(L);
