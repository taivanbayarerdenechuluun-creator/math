import { cubeCount, dihedral, isVisibleStack, key, mirrorH, rotateCW, rotations, type Fig, type Matrix } from "../../../lib/figures";
import { SPATIAL_MN } from "../mn";
import { L, rng, shuffle, type QDef } from "../types";
import { DIFFS, collect, int, pick, wrongNumbers, type Diff, type R } from "./util";

/*
 * 120 generated spatial-reasoning questions (24 per difficulty):
 *  - 60 shape transformations: a random polyomino with no symmetry at all (all 8 rotations and reflections differ), asked
 *    as "same shape rotated", 90° clockwise/counter-clockwise, 180° or mirror image. Wrong options are other symmetries
 *    of the shape; for "same shape" they are only mirror images, so exactly one option is correct;
 *  - 35 cube-counting items and 25 "which structure has exactly N cubes" items on isometric stacks whose columns are
 *    all visible (heights never increase toward the viewer), so the count is determinable from the picture.
 */

// ------------------------------------------------------------------ polyominoes

type Kind = "rotate" | "cw" | "ccw" | "r180" | "flip";
const TITLE: Record<Kind, string> = {
  rotate: "Which option shows the SAME shape, only rotated (not flipped)?",
  cw: "Which option shows this shape after a 90° clockwise rotation?",
  ccw: "Which option shows this shape after a 90° counter-clockwise rotation?",
  r180: "Which option shows this shape after a 180° rotation?",
  flip: "Which option shows this shape flipped left-to-right (mirror image)?",
};
const EXPLAIN: Record<Kind, string> = {
  rotate: "Rotating a shape never changes which way it ‘handles’. The options that cannot be turned into the original are mirror images.",
  cw: "Rotate the picture a quarter-turn to the right: the top row becomes the right-hand column.",
  ccw: "Rotate the picture a quarter-turn to the left: the top row becomes the left-hand column.",
  r180: "A half-turn flips the shape upside-down and left-to-right at the same time.",
  flip: "A mirror flip reverses each row left-to-right while keeping the rows in order.",
};

function randomShape(r: R, h: number, w: number, cells: number): Matrix | null {
  const m: Matrix = Array.from({ length: h }, () => Array(w).fill(0));
  m[int(r, 0, h - 1)][int(r, 0, w - 1)] = 1;
  let count = 1;
  for (let guard = 0; count < cells && guard < 100; guard++) {
    const cand: [number, number][] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (m[y][x] === 0 && ((y > 0 && m[y - 1][x]) || (y < h - 1 && m[y + 1][x]) || (x > 0 && m[y][x - 1]) || (x < w - 1 && m[y][x + 1]))) cand.push([y, x]);
    }
    const [y, x] = pick(r, cand);
    m[y][x] = 1;
    count++;
  }
  if (count < cells) return null;
  if (!m.every((row) => row.some(Boolean)) || !m[0].every((_, x) => m.some((row) => row[x]))) return null; // fills its whole box
  if (new Set(dihedral(m).map(key)).size !== 8) return null; // no rotational or mirror symmetry
  return m;
}

const SHAPE_SPEC: Record<Diff, { boxes: [number, number][]; cells: number[]; kinds: Kind[] }> = {
  1: { boxes: [[2, 3], [3, 2]], cells: [4, 5], kinds: ["cw", "ccw", "r180"] },
  2: { boxes: [[3, 3]], cells: [5], kinds: ["cw", "ccw", "flip", "rotate"] },
  3: { boxes: [[3, 3]], cells: [6], kinds: ["rotate", "flip", "cw", "ccw"] },
  4: { boxes: [[3, 4], [4, 3]], cells: [6, 7], kinds: ["rotate", "flip", "cw", "ccw", "r180"] },
  5: { boxes: [[4, 4]], cells: [7, 8], kinds: ["rotate", "ccw", "flip", "cw"] },
};

function transform(r: R, diff: Diff): QDef | null {
  const spec = SHAPE_SPEC[diff];
  const [h, w] = pick(r, spec.boxes);
  const base = randomShape(r, h, w, pick(r, spec.cells));
  if (!base) return null;
  const kind = pick(r, spec.kinds), k = int(r, 1, 3);
  const right = kind === "rotate" ? rotations(base)[k] : kind === "cw" ? rotateCW(base) : kind === "ccw" ? rotations(base)[3] : kind === "r180" ? rotations(base)[2] : mirrorH(base);
  const rotKeys = new Set(rotations(base).map(key));
  const seen = new Set([key(right)]);
  const pool = shuffle(dihedral(base).filter((m) => {
    const kk = key(m);
    if (seen.has(kk)) return false;
    seen.add(kk);
    return kind === "rotate" ? !rotKeys.has(kk) : true;
  }), r);
  if (pool.length < 3) return null;
  const fig = (m: Matrix) => ({ fig: { k: "grid" as const, cells: m } });
  return {
    cat: "spatial", diff, prompt: TITLE[kind], stem: { k: "grid", cells: base },
    right: fig(right), wrong: pool.slice(0, 3).map(fig), explanation: EXPLAIN[kind],
    mn: { prompt: SPATIAL_MN[kind].p, explanation: SPATIAL_MN[kind].e },
  };
}

// ------------------------------------------------------------------ cube stacks

const NOTE_EN = "All cubes rest on the floor with no gaps.";
const NOTE_MN = "Бүх шоо шалан дээр хоосон зайгүй байрласан.";
const iso = (heights: Matrix): Fig => ({ k: "iso", heights });

const STACK_SPEC: Record<Diff, { rows: number[]; cols: number[]; maxH: number; min: number; max: number }> = {
  1: { rows: [2], cols: [2], maxH: 2, min: 3, max: 6 },
  2: { rows: [2], cols: [2, 3], maxH: 3, min: 6, max: 12 },
  3: { rows: [3], cols: [3], maxH: 3, min: 8, max: 15 },
  4: { rows: [3], cols: [3], maxH: 4, min: 13, max: 20 },
  5: { rows: [3], cols: [3, 4], maxH: 5, min: 18, max: 30 },
};

/** A random stack whose heights never increase toward the viewer (right along a row, down a column). */
function randomStack(r: R, rows: number, cols: number, maxH: number): Matrix {
  const h: Matrix = [];
  for (let y = 0; y < rows; y++) {
    h.push([]);
    for (let x = 0; x < cols; x++) {
      const cap = Math.min(y > 0 ? h[y - 1][x] : maxH, x > 0 ? h[y][x - 1] : maxH);
      h[y].push(int(r, 0, cap));
    }
  }
  return h;
}

function cubeStack(r: R, diff: Diff, spec = STACK_SPEC[diff]): Matrix | null {
  const h = randomStack(r, pick(r, spec.rows), pick(r, spec.cols), spec.maxH);
  const n = cubeCount(h);
  return h[0][0] > 0 && n >= spec.min && n <= spec.max && isVisibleStack(h) ? h : null;
}

function countCubes(r: R, diff: Diff): QDef | null {
  const h = cubeStack(r, diff);
  if (!h) return null;
  const n = cubeCount(h), cols = h[0].length;
  const traps = [h.flat().filter((v) => v > 0).length, h.flat().reduce((a, b) => Math.max(a, b), 0) * cols * h.length, n + h.length];
  const wrong = wrongNumbers(r, n, traps, 1);
  if (!wrong) return null;
  const terms = h.flat().filter((v) => v > 0).join(" + ");
  return {
    cat: "spatial", diff, prompt: `How many cubes make up this structure? (${NOTE_EN})`, stem: iso(h),
    right: L(String(n)), wrong: wrong.map((x) => L(String(x))),
    explanation: `Add the column heights: ${terms} = ${n}.`,
    mn: { prompt: `Энэ бүтэц хэдэн шооноос бүрдэх вэ? (${NOTE_MN})`, explanation: `Баганы өндрүүдийг нэмнэ: ${terms} = ${n}.` },
  };
}

// Four structures whose totals all differ by at least `gap` cubes (the harder the level, the closer the totals).
const COMPARE_SPEC: Record<Diff, { rows: number[]; cols: number[]; maxH: number; min: number; max: number; gap: number }> = {
  1: { rows: [2], cols: [2], maxH: 3, min: 3, max: 9, gap: 2 },
  2: { rows: [2], cols: [2, 3], maxH: 3, min: 4, max: 14, gap: 2 },
  3: { rows: [3], cols: [3], maxH: 3, min: 8, max: 20, gap: 1 },
  4: { rows: [3], cols: [3], maxH: 4, min: 12, max: 28, gap: 1 },
  5: { rows: [3], cols: [3, 4], maxH: 5, min: 16, max: 40, gap: 1 },
};

function compareCubes(r: R, diff: Diff): QDef | null {
  const spec = COMPARE_SPEC[diff], gap = spec.gap;
  const rows = pick(r, spec.rows), cols = pick(r, spec.cols);
  const stacks: Matrix[] = [];
  for (let guard = 0; stacks.length < 4 && guard < 400; guard++) {
    const h = randomStack(r, rows, cols, spec.maxH);
    const n = cubeCount(h);
    if (h[0][0] === 0 || n < spec.min || n > spec.max || !isVisibleStack(h)) continue;
    if (stacks.some((s) => Math.abs(cubeCount(s) - n) < gap)) continue;
    stacks.push(h);
  }
  if (stacks.length < 4) return null;
  const [right, ...wrong] = stacks;
  const n = cubeCount(right), others = wrong.map(cubeCount).join(", ");
  return {
    cat: "spatial", diff, prompt: `Which structure is made of exactly ${n} cubes? (${NOTE_EN})`,
    right: { fig: iso(right) }, wrong: wrong.map((w) => ({ fig: iso(w) })),
    explanation: `Only one structure has ${n} cubes; the others have ${others}.`,
    mn: { prompt: `Аль бүтэц яг ${n} шооноос бүрдэх вэ? (${NOTE_MN})`, explanation: `Зөвхөн нэг бүтэц ${n} шоотой; бусад нь ${others} шоотой.` },
  };
}

/** Per difficulty: 12 shape transformations, 7 cube counts, 5 cube comparisons (24). */
export function generateSpatial(seen: Set<string> = new Set()): QDef[] {
  const r = rng(0x53504131); // "SPA1"
  const out: QDef[] = [];
  for (const diff of DIFFS) {
    out.push(...collect(12, seen, () => transform(r, diff), `spatial ${diff} shapes`));
    out.push(...collect(7, seen, () => countCubes(r, diff), `spatial ${diff} counts`));
    out.push(...collect(5, seen, () => compareCubes(r, diff), `spatial ${diff} comparisons`));
  }
  return out;
}
