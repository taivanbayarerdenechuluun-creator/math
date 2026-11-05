// Figure specs are plain data rendered by <FigureView>. Keeping visuals as data
// (not raw SVG strings) means questions can be verified programmatically and
// admin-authored content can never inject markup.

export type Shape = "square" | "circle" | "triangle" | "diamond" | "star" | "cross" | "arrow";
export type Fill = "solid" | "outline" | "light";

/** Mongolian names, used in explanations and screen-reader labels. */
export const SHAPE_MN: Record<Shape, string> = { square: "дөрвөлжин", circle: "тойрог", triangle: "гурвалжин", diamond: "ромб", star: "од", cross: "загалмай", arrow: "сум" };
export const FILL_MN: Record<Fill, string> = { solid: "дүүрэн", light: "цайвар", outline: "хүрээтэй" };

export type Glyph = { k: "glyph"; shape: Shape; rot?: number; fill?: Fill; n?: number };
/** cells: 1 = filled. full=true also draws empty cells (pattern-memory grids). */
export type Grid = { k: "grid"; cells: number[][]; full?: boolean };
/** Isometric stack of unit cubes: heights[row][col] = cubes in that column (all resting on the floor). */
export type Iso = { k: "iso"; heights: number[][] };
export type Fig = Glyph | Grid | Iso;
/** A row of figures; null renders as the "?" slot. */
export type Seq = { k: "seq"; items: (Fig | null)[] };
/**
 * Choice-reaction item. After a server-chosen random delay (minMs..maxMs) the correct pad lights up; the answer
 * only counts if it is that pad, pressed after it lit and within limitMs of the lighting.
 */
export type Reaction = { k: "reaction"; minMs: number; maxMs: number; limitMs: number };
export type Stem = Fig | Seq | Reaction;

export type Matrix = number[][];

export const rotateCW = (m: Matrix): Matrix =>
  m[0].map((_, c) => m.map((row) => row[c]).reverse());

export const mirrorH = (m: Matrix): Matrix => m.map((row) => [...row].reverse());

export const key = (m: Matrix) => m.map((r) => r.join("")).join("/");

export function rotations(m: Matrix): Matrix[] {
  const out = [m];
  for (let i = 1; i < 4; i++) out.push(rotateCW(out[i - 1]));
  return out;
}

/** All 8 symmetries of the square applied to m (4 rotations, 4 mirrored rotations). */
export function dihedral(m: Matrix): Matrix[] {
  return [...rotations(m), ...rotations(mirrorH(m))];
}

/** Canonical key for a glyph so equality checks in tests are exact. */
export function figKey(f: Fig): string {
  if (f.k === "grid") return `grid:${key(f.cells)}`;
  if (f.k === "iso") return `iso:${key(f.heights)}`;
  const rotates = f.shape === "arrow" || f.shape === "triangle";
  return `glyph:${f.shape}:${rotates ? ((f.rot ?? 0) % 360 + 360) % 360 : 0}:${f.fill ?? "solid"}:${f.n ?? 1}`;
}

/** Total number of cubes in an isometric stack. */
export const cubeCount = (heights: Matrix) => heights.reduce((a, row) => a + row.reduce((b, h) => b + h, 0), 0);

/**
 * True when every column's top face is visible from the fixed camera, i.e. heights never increase toward the
 * viewer (right along a row, down a column). Such stacks have no hidden columns, so the cube count is determinable.
 */
export function isVisibleStack(h: Matrix): boolean {
  return h.every((row, y) => row.every((v, x) => (x + 1 >= row.length || v >= row[x + 1]) && (y + 1 >= h.length || v >= h[y + 1][x])));
}

/** Deterministic delay before a reaction pad lights up (the same value on the server and in the payload). */
export function reactionDelayMs(seed: string, minMs: number, maxMs: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return minMs + ((h >>> 0) % (maxMs - minMs + 1));
}
