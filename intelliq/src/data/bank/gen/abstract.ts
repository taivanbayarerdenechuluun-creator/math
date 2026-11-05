import { FILL_MN, SHAPE_MN, figKey, type Fig, type Fill, type Glyph, type Matrix, type Shape } from "../../../lib/figures";
import { ABSTRACT_PROMPT_MN } from "../mn";
import { rng, shuffle, type Opt, type QDef } from "../types";
import { DIFFS, collect, int, pick, type Diff, type R } from "./util";

/*
 * 120 generated abstract-reasoning questions (24 per difficulty):
 *  - 78 figure sequences in which each attribute (shape, rotation, fill, number of copies) follows its own rule; harder
 *    levels combine two or three rules;
 *  - 42 grid sequences in which squares fill in along a path (rows, columns, snake, spiral) or a single square moves
 *    along it. A path puzzle is only kept when no other path in the family agrees with the squares shown but
 *    continues differently, so the answer is unique.
 */

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

// ------------------------------------------------------------------ figure sequences

const FILLS2: Fill[][] = [["solid", "outline"], ["outline", "solid"], ["solid", "light"], ["light", "solid"], ["light", "outline"], ["outline", "light"]];
const FILLS3: Fill[][] = [
  ["solid", "light", "outline"], ["solid", "outline", "light"], ["light", "solid", "outline"],
  ["light", "outline", "solid"], ["outline", "solid", "light"], ["outline", "light", "solid"],
];
type Attr = { shape: Shape; rot: number; fill: Fill; n: number };
type RuleName = "rot" | "count" | "fill" | "shape";
const RULESETS: Record<Diff, RuleName[][]> = {
  1: [["count"], ["fill"], ["shape"]],
  2: [["rot"], ["count"], ["fill"], ["shape"]],
  3: [["rot", "count"], ["rot", "fill"], ["shape", "count"], ["shape", "fill"], ["count", "fill"]],
  4: [["rot", "count", "fill"], ["shape", "count", "fill"]],
  5: [["rot", "count", "fill"], ["shape", "count", "fill"]],
};
const glyph = (a: Attr): Glyph => ({ k: "glyph", shape: a.shape, rot: a.rot, fill: a.fill, n: a.n });

function glyphSequence(r: R, diff: Diff): QDef | null {
  const SHAPES: Shape[] = ["square", "circle", "triangle", "diamond", "star", "cross"];
  const rules = pick(r, RULESETS[diff]);
  const has = (x: RuleName) => rules.includes(x);
  const shown = diff === 5 ? 5 : 4;
  const step = diff === 1 ? 90 : pick(r, [45, 90, -90, -45]);
  const rot0 = int(r, 0, 7) * 45;
  const delta = diff === 1 ? 1 : pick(r, [1, -1]);
  const fills = diff === 1 ? pick(r, FILLS2) : diff === 2 ? pick(r, [...FILLS2, ...FILLS3]) : pick(r, FILLS3);
  const f0 = int(r, 0, fills.length - 1);
  const cycle = shuffle(SHAPES, r).slice(0, 3);
  const n0 = delta === 1 ? int(r, 1, 6 - shown) : int(r, shown + 1, 6);
  const nConst = pick(r, [1, 1, 2, 3]);
  const fillConst = pick(r, ["solid", "solid", "light", "outline"] as Fill[]);
  // only the arrow and the triangle visibly rotate
  const baseShape: Shape = has("rot") ? pick(r, ["arrow", "triangle"] as Shape[]) : pick(r, ["square", "circle", "diamond", "star", "cross"] as Shape[]);
  const at = (i: number): Attr => ({
    shape: has("shape") ? cycle[i % 3] : baseShape,
    rot: has("rot") ? (((rot0 + step * i) % 360) + 360) % 360 : 0,
    fill: has("fill") ? fills[(f0 + i) % fills.length] : fillConst,
    n: has("count") ? n0 + delta * i : nConst,
  });
  const items = Array.from({ length: shown }, (_, i) => glyph(at(i)));
  const ans = at(shown);
  if (ans.n < 1 || ans.n > 6) return null;
  const answer = glyph(ans);

  const variants: Attr[] = [];
  const vary = (patch: Partial<Attr>) => variants.push({ ...ans, ...patch });
  if (has("rot")) { vary({ rot: (ans.rot + Math.abs(step)) % 360 }); vary({ rot: (ans.rot - Math.abs(step) + 360) % 360 }); vary({ rot: (ans.rot + 180) % 360 }); }
  if (has("count")) { vary({ n: ans.n + 1 }); vary({ n: Math.max(1, ans.n - 1) }); }
  if (has("fill")) for (const f of ["solid", "light", "outline"] as Fill[]) if (f !== ans.fill) vary({ fill: f });
  if (has("shape")) for (const sh of cycle) if (sh !== ans.shape) vary({ shape: sh });
  vary({ n: ans.n + 2 });
  vary({ fill: ans.fill === "solid" ? "outline" : "solid" });
  const seen = new Set([figKey(answer)]);
  const wrong: Opt[] = [];
  for (const v of shuffle(variants, r)) {
    const f = glyph(v), k = figKey(f);
    if (seen.has(k) || (f.n ?? 1) > 6) continue; // more copies than this are hard to count at a glance
    seen.add(k);
    wrong.push({ fig: f });
    if (wrong.length === 3) break;
  }
  if (wrong.length < 3) return null;

  const dir = step > 0 ? ["clockwise", "цагийн зүүний дагуу"] : ["counter-clockwise", "цагийн зүүний эсрэг"];
  const parts: Record<RuleName, [string, string]> = {
    rot: [`The ${baseShape} turns ${Math.abs(step)}° ${dir[0]} at each step.`, `${cap(SHAPE_MN[baseShape])} алхам бүрт ${dir[1]} ${Math.abs(step)}°-аар эргэнэ.`],
    count: [delta === 1 ? "One more copy is added at each step." : "One copy is removed at each step.", delta === 1 ? "Алхам бүрт нэг хувь нэмэгдэнэ." : "Алхам бүрт нэг хувь хасагдана."],
    fill: [`The fill cycles through ${fills.join(" → ")}.`, `Будалт ${fills.map((x) => FILL_MN[x]).join(" → ")} дарааллаар давтагдана.`],
    shape: [`The shapes repeat in a cycle of three: ${cycle.join(", ")}.`, `Дүрсүүд гурваар давтагдана: ${cycle.map((x) => SHAPE_MN[x]).join(", ")}.`],
  };
  return {
    cat: "abstract", diff,
    prompt: "Which figure completes the sequence?",
    stem: { k: "seq", items: [...items, null] },
    right: { fig: answer }, wrong,
    explanation: rules.map((x) => parts[x][0]).join(" "),
    mn: { prompt: ABSTRACT_PROMPT_MN, explanation: rules.map((x) => parts[x][1]).join(" ") },
  };
}

// ------------------------------------------------------------------ path puzzles on a grid

type Pt = [number, number]; // row, column
export type Path = { name: string; en: string; mn: string; cells: Pt[] };

function spiral(size: number, clockwise: boolean): Pt[] {
  const seen = new Set<string>(), out: Pt[] = [];
  const dirs: Pt[] = clockwise ? [[0, 1], [1, 0], [0, -1], [-1, 0]] : [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let [row, col, d] = [0, 0, 0];
  for (let i = 0; i < size * size; i++) {
    out.push([row, col]);
    seen.add(`${row},${col}`);
    const next = (): Pt => [row + dirs[d][0], col + dirs[d][1]];
    let [nr, nc] = next();
    if (nr < 0 || nc < 0 || nr >= size || nc >= size || seen.has(`${nr},${nc}`)) { d = (d + 1) % 4; [nr, nc] = next(); }
    [row, col] = [nr, nc];
  }
  return out;
}

export function pathsFor(size: number): Path[] {
  const idx = Array.from({ length: size }, (_, i) => i);
  const row = idx.flatMap((r) => idx.map((c): Pt => [r, c]));
  const col = idx.flatMap((c) => idx.map((r): Pt => [r, c]));
  const snake = idx.flatMap((r) => (r % 2 === 0 ? idx : [...idx].reverse()).map((c): Pt => [r, c]));
  const snakeCol = idx.flatMap((c) => (c % 2 === 0 ? idx : [...idx].reverse()).map((r): Pt => [r, c]));
  const diag = [...row].sort((p, q) => p[0] + p[1] - (q[0] + q[1]) || p[0] - q[0]);
  return [
    { name: "colRev", cells: [...col].reverse(), en: "column by column, bottom to top, from the right", mn: "багана баганаар, доороос дээш, баруунаас зүүн тийш" },
    { name: "snakeCol", cells: snakeCol, en: "column by column, changing direction on every column (a snake)", mn: "багана баганаар, багана бүрт чиглэлээ сольж (могой маягаар)" },
    { name: "snakeRev", cells: [...snake].reverse(), en: "row by row from the bottom-right corner, changing direction on every row", mn: "баруун доод буланаас эхлэн мөр мөрөөр, мөр бүрт чиглэлээ сольж" },
    { name: "diag", cells: diag, en: "along the diagonals, starting at the top-left corner", mn: "ташуу шугамаар, зүүн дээд буланаас эхлэн" },
    { name: "diagRev", cells: [...diag].reverse(), en: "along the diagonals, starting at the bottom-right corner", mn: "ташуу шугамаар, баруун доод буланаас эхлэн" },
    { name: "row", cells: row, en: "row by row, left to right, from the top", mn: "мөр мөрөөр, зүүнээс баруун тийш, дээрээс доош" },
    { name: "col", cells: col, en: "column by column, top to bottom, from the left", mn: "багана баганаар, дээрээс доош, зүүнээс баруун тийш" },
    { name: "snake", cells: snake, en: "row by row, changing direction on every row (a snake)", mn: "мөр мөрөөр, мөр бүрт чиглэлээ сольж (могой маягаар)" },
    { name: "rowRev", cells: [...row].reverse(), en: "row by row, right to left, from the bottom", mn: "мөр мөрөөр, баруунаас зүүн тийш, доороос дээш" },
    { name: "spiralCW", cells: spiral(size, true), en: "in a clockwise spiral from the top-left corner", mn: "зүүн дээд буланаас цагийн зүүний дагуу спираль маягаар" },
    { name: "spiralCCW", cells: spiral(size, false), en: "in a counter-clockwise spiral from the top-left corner", mn: "зүүн дээд буланаас цагийн зүүний эсрэг спираль маягаар" },
  ];
}

const matrix = (size: number, cells: Pt[]): Matrix => {
  const m: Matrix = Array.from({ length: size }, () => Array(size).fill(0));
  for (const [r, c] of cells) m[r][c] = 1;
  return m;
};
const gridFig = (size: number, cells: Pt[]): Fig => ({ k: "grid", cells: matrix(size, cells), full: true });
const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];

function gridPath(r: R, diff: Diff): QDef | null {
  const size = diff <= 2 ? 3 : pick(r, [3, 4]);
  const paths = pathsFor(size);
  const path = pick(r, paths);
  const moving = diff >= 2 ? r() < 0.5 : false; // level 1: squares accumulate; later also a single moving square
  // The squares shown must not fit another path of the family that continues differently; if they do, show one more.
  const unique = (n: number) => paths.every((q) => q === path || !path.cells.slice(0, n).every((p, i) => same(p, q.cells[i])) || same(q.cells[n], path.cells[n]));
  let shown = diff <= 3 ? 4 : 5;
  if (!unique(shown)) shown++;
  if (!unique(shown)) return null;
  const state = (i: number): Pt[] => (moving ? [path.cells[i]] : path.cells.slice(0, i + 1));
  const items = Array.from({ length: shown }, (_, i) => gridFig(size, state(i)));
  const right = state(shown);
  const wrongSets: Pt[][] = [];
  const free = path.cells.filter((p) => !right.some((x) => same(x, p)));
  const stray = shuffle(free, r);
  // typical mistakes: the wrong next square, no change, two new squares, the square before the right one
  const base = moving ? [] : state(shown - 1);
  wrongSets.push([...base, stray[0]]);
  wrongSets.push(state(shown - 1));
  wrongSets.push(moving ? [path.cells[shown + 1]] : [...base, path.cells[shown], path.cells[shown + 1]]);
  wrongSets.push([...base, stray[1]]);
  wrongSets.push(moving ? [stray[0], stray[1]] : [...base, stray[0], stray[1]]);
  const seen = new Set([figKey(gridFig(size, right))]);
  const wrong: Opt[] = [];
  for (const w of wrongSets) {
    if (w.some((p) => !p || p[0] === undefined)) continue;
    const f = gridFig(size, w), k = figKey(f);
    if (seen.has(k)) continue;
    seen.add(k);
    wrong.push({ fig: f });
    if (wrong.length === 3) break;
  }
  if (wrong.length < 3) return null;
  const how = moving
    ? [`A single square moves ${path.en}, one step at a time.`, `Ганц нүд ${path.mn} нэг алхмаар хөдөлнө.`]
    : [`One more square is filled at each step, ${path.en}.`, `Алхам бүрт ${path.mn} нэг нүд нэмж будагдана.`];
  return {
    cat: "abstract", diff,
    prompt: "Which figure completes the sequence?",
    stem: { k: "seq", items: [...items, null] },
    right: { fig: gridFig(size, right) }, wrong,
    explanation: `${how[0]} After ${shown} steps the next square is number ${shown + 1} on that path.`,
    mn: { prompt: ABSTRACT_PROMPT_MN, explanation: `${how[1]} ${shown} алхмын дараа тэр зам дээрх ${shown + 1}-р нүд дараагийнх нь болно.` },
  };
}

/** Questions per difficulty: figure sequences, then grid paths (sums to 24). */
const SHARE: Record<Diff, [number, number]> = { 1: [18, 6], 2: [18, 6], 3: [16, 8], 4: [14, 10], 5: [12, 12] };

/** 120 questions, grouped by difficulty (24 each), deterministic. */
export function generateAbstract(seen: Set<string> = new Set()): QDef[] {
  const r = rng(0x41425331); // "ABS1"
  const out: QDef[] = [];
  for (const diff of DIFFS) {
    const [g, p] = SHARE[diff];
    out.push(...collect(g, seen, () => glyphSequence(r, diff), `abstract ${diff} figures`));
    out.push(...collect(p, seen, () => gridPath(r, diff), `abstract ${diff} paths`));
  }
  return out;
}
