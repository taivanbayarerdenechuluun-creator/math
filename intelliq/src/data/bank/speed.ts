import type { Fig, Glyph, Shape, Fill } from "../../lib/figures";
import { rng, shuffle, L, type QDef } from "./types";

const rand = rng(31337);
const gl = (shape: Shape, rot = 0, fill: Fill = "solid", n = 1): Glyph => ({ k: "glyph", shape, rot, fill, n });

const arith = (diff: QDef["diff"], expr: string, value: number, limit: number): QDef => {
  const wrong = new Set<number>();
  const cands = [value + 1, value - 1, value + 10, value - 10, value + 2, value - 2];
  for (const c of shuffle(cands, rand)) if (c > 0 && c !== value && wrong.size < 3) wrong.add(c);
  return {
    cat: "speed",
    diff,
    prompt: `Calculate quickly:  ${expr}`,
    timeLimitSec: limit,
    right: L(String(value)),
    wrong: [...wrong].map((n) => L(String(n))),
    explanation: `${expr} = ${value}.`,
    mn: { prompt: `Хурдан бод:  ${expr}`, explanation: `${expr} = ${value}.` },
  };
};

const stringMatch = (diff: QDef["diff"], target: string, limit: number): QDef => {
  const alt = (): string => {
    const a = target.split("");
    const i = Math.floor(rand() * (a.length - 1));
    if (rand() < 0.5 && a[i] !== a[i + 1]) [a[i], a[i + 1]] = [a[i + 1], a[i]];
    else a[i] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(rand() * 32)];
    return a.join("");
  };
  const wrong = new Set<string>();
  let guard = 0;
  while (wrong.size < 3 && guard++ < 500) {
    const s = alt();
    if (s !== target) wrong.add(s);
  }
  return {
    cat: "speed",
    diff,
    prompt: `Find the code that is IDENTICAL to the target:  ${target}`,
    timeLimitSec: limit,
    right: L(target),
    wrong: [...wrong].map(L),
    explanation: `The target was ${target}; each other option differs by one character or one swapped pair.`,
    mn: { prompt: `Зорилтот кодтой ЯГ ИЖИЛ кодыг ол:  ${target}`, explanation: `Зорилтот код ${target} байсан; бусад сонголт бүр нэг тэмдэгтээр эсвэл нэг хос солигдсоноор ялгаатай.` },
  };
};

const oddOne = (diff: QDef["diff"], base: Fig, odd: Fig, oddIndex: number, limit: number): QDef => {
  const items: Fig[] = Array.from({ length: 5 }, (_, i) => (i === oddIndex ? odd : base));
  return {
    cat: "speed",
    diff,
    prompt: "Which figure is different from the others? (1–5, left to right)",
    stem: { k: "seq", items },
    timeLimitSec: limit,
    fixedOrder: true,
    right: L(String(oddIndex + 1)),
    wrong: [0, 1, 2, 3, 4].filter((i) => i !== oddIndex).map((i) => L(String(i + 1))),
    rightIndex: oddIndex,
    explanation: `Figure ${oddIndex + 1} is the odd one out; the other four are identical.`,
    mn: { prompt: "Аль дүрс бусдаасаа ялгаатай вэ? (1–5, зүүнээс баруун тийш)", explanation: `${oddIndex + 1}-р дүрс ялгаатай; бусад дөрөв нь ижил.` },
  };
};

export const speed: QDef[] = [
  arith(1, "8 + 9", 17, 12),
  stringMatch(1, "KQ47M", 15),
  oddOne(1, gl("circle"), gl("square"), 2, 12),
  arith(2, "24 + 37", 61, 12),
  stringMatch(2, "T8H2WZ", 15),
  oddOne(2, gl("diamond", 0, "solid"), gl("diamond", 0, "outline"), 4, 12),
  arith(3, "13 × 4", 52, 12),
  stringMatch(3, "R5N9XB2", 14),
  oddOne(3, gl("arrow", 0), gl("arrow", 90), 1, 12),
  arith(4, "48 − 29 + 17", 36, 11),
  stringMatch(4, "P3L8V6D1", 14),
  oddOne(4, gl("arrow", 0), gl("arrow", 30), 3, 11),
  arith(5, "(84 ÷ 7) + (9 × 5)", 57, 11),
  stringMatch(5, "Q9G2T7K4C5", 13),
  oddOne(5, gl("triangle", 0, "solid", 4), gl("triangle", 0, "solid", 5), 0, 11),
];
