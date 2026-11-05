import { dihedral, key, mirrorH, rotateCW, rotations, type Matrix } from "../../lib/figures";
import { rng, shuffle, type QDef } from "./types";
import { SPATIAL_MN } from "./mn";

// Every shape is chiral (not identical to its mirror image), which is what
// makes "rotated" and "flipped" options unambiguous. bank.test.ts re-checks it.
const SHAPES: Record<string, Matrix> = {
  L: [[1, 0], [1, 0], [1, 1]],
  P: [[1, 1], [1, 1], [1, 0]],
  S: [[0, 1, 1], [1, 1, 0]],
  N: [[0, 1], [0, 1], [1, 1], [1, 0]],
  Y: [[0, 1], [1, 1], [0, 1], [0, 1]],
  F: [[0, 1, 1], [1, 1, 0], [0, 1, 0]],
  R6: [[1, 1, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]],
  R7: [[1, 0, 0], [1, 1, 1], [0, 0, 1], [0, 0, 1]],
};

type Kind = "rotate" | "cw" | "ccw" | "r180" | "flip";
const TITLE: Record<Kind, string> = {
  rotate: "Which option shows the SAME shape, only rotated (not flipped)?",
  cw: "Which option shows this shape after a 90° clockwise rotation?",
  ccw: "Which option shows this shape after a 90° counter-clockwise rotation?",
  r180: "Which option shows this shape after a 180° rotation?",
  flip: "Which option shows this shape flipped left-to-right (mirror image)?",
};

function correctFor(kind: Kind, base: Matrix, k: number): Matrix {
  switch (kind) {
    case "rotate": return rotations(base)[k];
    case "cw": return rotateCW(base);
    case "ccw": return rotations(base)[3];
    case "r180": return rotations(base)[2];
    case "flip": return mirrorH(base);
  }
}

let seed = 4242;
function build(diff: QDef["diff"], name: string, kind: Kind, k = 1): QDef {
  const base = SHAPES[name];
  const right = correctFor(kind, base, k);
  const rand = rng(seed++);
  // Distractor pool: for "rotate" only mirrored versions (never any rotation of the original),
  // otherwise any other symmetry of the shape that differs from the right answer.
  const rotKeys = new Set(rotations(base).map(key));
  const seen = new Set([key(right)]);
  let pool = dihedral(base).filter((m) => {
    const kk = key(m);
    if (seen.has(kk)) return false;
    seen.add(kk);
    return kind === "rotate" ? !rotKeys.has(kk) : true;
  });
  pool = shuffle(pool, rand);
  const asFig = (m: Matrix) => ({ fig: { k: "grid" as const, cells: m } });
  const explanation = {
    rotate: "Rotating a shape never changes which way it ‘handles’. The options that cannot be turned into the original are mirror images.",
    cw: "Rotate the picture a quarter-turn to the right: the top row becomes the right-hand column.",
    ccw: "Rotate the picture a quarter-turn to the left: the top row becomes the left-hand column.",
    r180: "A half-turn flips the shape upside-down and left-to-right at the same time.",
    flip: "A mirror flip reverses each row left-to-right while keeping the rows in order.",
  }[kind];
  return {
    cat: "spatial",
    diff,
    prompt: TITLE[kind],
    stem: { k: "grid", cells: base },
    right: asFig(right),
    wrong: pool.slice(0, 3).map(asFig),
    explanation,
    mn: { prompt: SPATIAL_MN[kind].p, explanation: SPATIAL_MN[kind].e },
  };
}

export const spatial: QDef[] = [
  build(1, "L", "rotate", 1),
  build(1, "L", "rotate", 2),
  build(1, "L", "cw"),
  build(2, "P", "rotate", 3),
  build(2, "P", "cw"),
  build(2, "S", "flip"),
  build(3, "N", "rotate", 1),
  build(3, "Y", "rotate", 2),
  build(3, "F", "cw"),
  build(4, "F", "rotate", 3),
  build(4, "Y", "flip"),
  build(4, "N", "ccw"),
  build(5, "R6", "rotate", 1),
  build(5, "R7", "rotate", 3),
  build(5, "R6", "r180"),
];

export const SPATIAL_SHAPES = SHAPES;
