import { cubeCount, type Fig, type Matrix } from "../../lib/figures";
import { L, type QDef } from "./types";

// 3D visualisation items. Every stack is a "visible stack": heights never increase toward the viewer
// (checked by bank.test.ts via isVisibleStack), so no column is hidden behind another and the cube count is
// determinable from the picture given the stated assumption that cubes rest on the floor with no gaps.
const iso = (heights: Matrix): Fig => ({ k: "iso", heights });
const NOTE_EN = "All cubes rest on the floor with no gaps.";
const NOTE_MN = "Бүх шоо шалан дээр хоосон зайгүй байрласан.";

const count = (diff: QDef["diff"], heights: Matrix, wrongSums: number[]): QDef => {
  const n = cubeCount(heights);
  const terms = heights.flat().filter((v) => v > 0).join(" + ");
  return {
    cat: "spatial",
    diff,
    prompt: `How many cubes make up this structure? (${NOTE_EN})`,
    stem: iso(heights),
    right: L(String(n)),
    wrong: wrongSums.map((x) => L(String(x))),
    explanation: `Add the column heights: ${terms} = ${n}.`,
    mn: { prompt: `Энэ бүтэц хэдэн шооноос бүрдэх вэ? (${NOTE_MN})`, explanation: `Баганы өндрүүдийг нэмнэ: ${terms} = ${n}.` },
  };
};

const compare = (diff: QDef["diff"], n: number, right: Matrix, wrong: Matrix[]): QDef => {
  const others = wrong.map(cubeCount).join(", ");
  return {
    cat: "spatial",
    diff,
    prompt: `Which structure is made of exactly ${n} cubes? (${NOTE_EN})`,
    right: { fig: iso(right) },
    wrong: wrong.map((w) => ({ fig: iso(w) })),
    explanation: `Only one structure has ${n} cubes; the others have ${others}.`,
    mn: { prompt: `Аль бүтэц яг ${n} шооноос бүрдэх вэ? (${NOTE_MN})`, explanation: `Зөвхөн нэг бүтэц ${n} шоотой; бусад нь ${others} шоотой.` },
  };
};

export const spatial3d: QDef[] = [
  count(1, [[2, 1], [1, 0]], [3, 5, 6]),
  compare(1, 3, [[2, 1], [0, 0]], [[[1, 1], [0, 0]], [[2, 1], [1, 0]], [[2, 2], [1, 0]]]),
  count(2, [[3, 2], [2, 1]], [7, 9, 10]),
  compare(2, 6, [[3, 2], [1, 0]], [[[2, 2], [1, 0]], [[3, 2], [1, 1]], [[3, 2], [2, 1]]]),
  count(3, [[3, 2, 1], [2, 1, 0], [1, 0, 0]], [8, 9, 11]),
  compare(3, 9, [[3, 2, 1], [2, 1, 0]], [[[3, 2, 1], [1, 1, 0]], [[3, 2, 1], [2, 1, 0], [1, 0, 0]], [[3, 2, 2], [2, 1, 0], [1, 0, 0]]]),
  count(4, [[4, 3, 2], [3, 2, 1], [1, 1, 0]], [15, 16, 18]),
  compare(4, 13, [[4, 3, 2], [2, 1, 0], [1, 0, 0]], [[[4, 3, 1], [2, 1, 0], [1, 0, 0]], [[4, 3, 2], [2, 2, 0], [1, 0, 0]], [[4, 3, 2], [3, 2, 0], [1, 0, 0]]]),
  count(5, [[4, 4, 3], [3, 2, 2], [2, 1, 1]], [20, 21, 23]),
  compare(5, 20, [[4, 3, 3], [3, 2, 1], [2, 1, 1]], [[[4, 3, 3], [3, 2, 1], [1, 1, 0]], [[4, 4, 3], [3, 2, 1], [2, 1, 1]], [[4, 4, 3], [3, 2, 2], [2, 1, 1]]]),
];
