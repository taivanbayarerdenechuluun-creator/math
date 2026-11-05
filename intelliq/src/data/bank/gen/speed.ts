import type { Fig, Fill, Glyph, Shape } from "../../../lib/figures";
import { L, rng, shuffle, type QDef } from "../types";
import { DIFFS, collect, int, pick, wrongNumbers, type Diff, type R } from "./util";

/*
 * 120 generated processing-speed questions (24 per difficulty), all timed: quick arithmetic (8), find the identical
 * code (6), the odd one out among five figures (5) and counting a letter in a string (5). Harder levels use bigger
 * numbers, longer strings and smaller differences between figures, with a little less time.
 */

const LIMIT: Record<Diff, { arith: number; code: number; odd: number; count: number }> = {
  1: { arith: 12, code: 15, odd: 12, count: 15 },
  2: { arith: 12, code: 15, odd: 12, count: 15 },
  3: { arith: 12, code: 14, odd: 12, count: 14 },
  4: { arith: 11, code: 14, odd: 11, count: 14 },
  5: { arith: 11, code: 13, odd: 11, count: 13 },
};

// ------------------------------------------------------------------ arithmetic

function arithmetic(r: R, diff: Diff): QDef | null {
  const a = int(r, 3, 14), b = int(r, 3, 12), c = int(r, 5, 30), d = int(r, 2, 9);
  let expr: string, value: number, trap: number | undefined;
  switch (diff) {
    case 1: {
      const x = int(r, 5, 19), y = int(r, 3, 19);
      if (r() < 0.5) { expr = `${x} + ${y}`; value = x + y; } else { if (x <= y) return null; expr = `${x} − ${y}`; value = x - y; }
      break;
    }
    case 2: {
      const x = int(r, 20, 79), y = int(r, 11, 49);
      if (r() < 0.5) { expr = `${x} + ${y}`; value = x + y; } else { if (x <= y) return null; expr = `${x} − ${y}`; value = x - y; }
      break;
    }
    case 3: expr = `${a} × ${b}`; value = a * b; break;
    case 4:
      if (r() < 0.5) { const x = int(r, 40, 99), y = int(r, 10, 49); expr = `${x} − ${y} + ${c}`; value = x - y + c; trap = x - (y + c); }
      else { if (a * b <= c) return null; expr = `${a} × ${b} − ${c}`; value = a * b - c; }
      break;
    default:
      if (r() < 0.5) { const q = int(r, 5, 15), v = d; expr = `(${q * v} ÷ ${v}) + (${a} × ${d + 1})`; value = q + a * (d + 1); }
      else { expr = `(${a} + ${b}) × ${d} − ${c}`; value = (a + b) * d - c; trap = a + b * d - c; }
  }
  if (!Number.isInteger(value) || value < 1) return null;
  const wrong = wrongNumbers(r, value, trap !== undefined ? [trap] : [], 1);
  if (!wrong) return null;
  return {
    cat: "speed", diff, timeLimitSec: LIMIT[diff].arith,
    prompt: `Calculate quickly:  ${expr}`, right: L(String(value)), wrong: wrong.map((v) => L(String(v))),
    explanation: `The answer is ${value}: ${expr} = ${value}.`,
    mn: { prompt: `Хурдан бод:  ${expr}`, explanation: `Хариу нь ${value}: ${expr} = ${value}.` },
  };
}

// ------------------------------------------------------------------ identical code

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN: Record<Diff, [number, number]> = { 1: [4, 5], 2: [5, 6], 3: [6, 7], 4: [8, 8], 5: [9, 10] };

function identicalCode(r: R, diff: Diff): QDef | null {
  const target = Array.from({ length: int(r, ...CODE_LEN[diff]) }, () => ALPHA[int(r, 0, ALPHA.length - 1)]).join("");
  const wrong = new Set<string>();
  for (let guard = 0; wrong.size < 3 && guard < 500; guard++) {
    const a = target.split("");
    const i = int(r, 0, a.length - 2);
    if (r() < 0.5 && a[i] !== a[i + 1]) [a[i], a[i + 1]] = [a[i + 1], a[i]];
    else a[i] = ALPHA[int(r, 0, ALPHA.length - 1)];
    const s = a.join("");
    if (s !== target) wrong.add(s);
  }
  if (wrong.size < 3) return null;
  return {
    cat: "speed", diff, timeLimitSec: LIMIT[diff].code,
    prompt: `Find the code that is IDENTICAL to the target:  ${target}`, right: L(target), wrong: [...wrong].map((w) => L(w)),
    explanation: `The target was ${target}; each other option differs by one character or one swapped pair.`,
    mn: { prompt: `Зорилтот кодтой ЯГ ИЖИЛ кодыг ол:  ${target}`, explanation: `Зорилтот код ${target} байсан; бусад сонголт бүр нэг тэмдэгтээр эсвэл нэг хос солигдсоноор ялгаатай.` },
  };
}

// ------------------------------------------------------------------ odd one out

const gl = (shape: Shape, rot = 0, fill: Fill = "solid", n = 1): Glyph => ({ k: "glyph", shape, rot, fill, n });
const PLAIN: Shape[] = ["square", "circle", "diamond", "star", "cross", "triangle"];

function oddFigure(r: R, diff: Diff): QDef | null {
  let base: Fig, odd: Fig;
  const shape = pick(r, PLAIN), fill = pick(r, ["solid", "outline", "light"] as Fill[]);
  switch (diff) {
    case 1: { const other = pick(r, PLAIN.filter((s) => s !== shape)); base = gl(shape, 0, "solid"); odd = gl(other, 0, "solid"); break; }
    case 2: { const f2 = pick(r, (["solid", "outline", "light"] as Fill[]).filter((f) => f !== fill)); base = gl(shape, 0, fill); odd = gl(shape, 0, f2); break; }
    case 3:
      if (r() < 0.5) { base = gl("arrow", 0); odd = gl("arrow", pick(r, [90, 180, 270])); }
      else { const n = int(r, 1, 3); base = gl(shape, 0, "solid", n); odd = gl(shape, 0, "solid", n + 2); }
      break;
    case 4:
      if (r() < 0.5) { const rot = int(r, 0, 7) * 45; base = gl("arrow", rot); odd = gl("arrow", (rot + 45) % 360); }
      else { const n = int(r, 2, 4); base = gl(shape, 0, "solid", n); odd = gl(shape, 0, "solid", n + 1); }
      break;
    default:
      if (r() < 0.5) { const rot = int(r, 0, 11) * 30; base = gl("triangle", rot); odd = gl("triangle", (rot + 30) % 360); }
      else { const n = int(r, 3, 5); base = gl(shape, 0, fill, n); odd = gl(shape, 0, fill, n + 1); }
  }
  const at = int(r, 0, 4);
  const items: Fig[] = Array.from({ length: 5 }, (_, i) => (i === at ? odd : base));
  return {
    cat: "speed", diff, timeLimitSec: LIMIT[diff].odd,
    prompt: "Which figure is different from the others? (1–5, left to right)",
    stem: { k: "seq", items }, fixedOrder: true,
    right: L(String(at + 1)), wrong: [0, 1, 2, 3, 4].filter((i) => i !== at).map((i) => L(String(i + 1))), rightIndex: at,
    explanation: `Figure ${at + 1} is the odd one out; the other four are identical.`,
    mn: { prompt: "Аль дүрс бусдаасаа ялгаатай вэ? (1–5, зүүнээс баруун тийш)", explanation: `${at + 1}-р дүрс ялгаатай; бусад дөрөв нь ижил.` },
  };
}

// ------------------------------------------------------------------ counting a letter

const COUNT_LEN: Record<Diff, number> = { 1: 8, 2: 10, 3: 12, 4: 14, 5: 16 };

function countLetter(r: R, diff: Diff): QDef | null {
  const pool = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
  const letter = pick(r, pool), n = COUNT_LEN[diff];
  const times = diff <= 2 ? int(r, 1, 3) : int(r, 2, 5);
  const others = pool.filter((c) => c !== letter);
  const chars = [...Array(times).fill(letter), ...Array.from({ length: n - times }, () => pick(r, others))];
  const text = shuffle(chars, r).join("");
  const wrong = wrongNumbers(r, times, [times + 1, times - 1, times + 2], 0);
  if (!wrong) return null;
  return {
    cat: "speed", diff, timeLimitSec: LIMIT[diff].count,
    prompt: `How many times does the letter ${letter} appear in this string?  ${text}`,
    right: L(String(times)), wrong: wrong.map((v) => L(String(v))),
    explanation: `The letter ${letter} appears ${times} time${times > 1 ? "s" : ""} in ${text}.`,
    mn: { prompt: `Доорх мөрөнд ${letter} үсэг хэдэн удаа байна вэ?  ${text}`, explanation: `${text} мөрөнд ${letter} үсэг ${times} удаа байна.` },
  };
}

const SHARE: [(r: R, d: Diff) => QDef | null, number][] = [[arithmetic, 8], [identicalCode, 6], [oddFigure, 5], [countLetter, 5]];

/** 120 questions, grouped by difficulty (24 each), deterministic. */
export function generateSpeed(seen: Set<string> = new Set()): QDef[] {
  const r = rng(0x53504431); // "SPD1"
  const out: QDef[] = [];
  for (const diff of DIFFS) SHARE.forEach(([make, n], i) => out.push(...collect(n, seen, () => make(r, diff), `speed ${diff}/${i}`)));
  return out;
}
