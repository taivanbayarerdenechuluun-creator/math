import { figKey, type Matrix } from "../../../lib/figures";
import { ORD_MN, WORD_MN } from "../mn";
import { L, rng, shuffle, type Opt, type QDef } from "../types";
import { DIFFS, collect, int, pick, spaced, type Diff, type R } from "./util";

/*
 * 120 generated memory questions (24 per difficulty). Every item shows a stimulus for a limited time, then asks about
 * it: digit sequences (same order, reverse, "which digit came after …"), word lists (position, "which was NOT in
 * the list"), consonant sequences and grids of highlighted squares. Harder levels use longer sequences, so the load on
 * working memory rises with the difficulty. The answer is always derived from the stimulus.
 */

const ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"];
const WORDS = Object.keys(WORD_MN);
const CONSONANTS = "BCDFGHJKLMNPQRSTVWXZ".split("");
const mnWords = (list: string[]) => list.map((w) => WORD_MN[w]);
const digitsOf = (r: R, n: number) => shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 0], r).slice(0, n).join(""); // distinct digits

function digitWrong(r: R, correct: string): string[] | null {
  const out = new Set<string>();
  for (let guard = 0; out.size < 3 && guard < 200; guard++) {
    const a = correct.split("");
    if (out.size % 2 === 0) { const i = int(r, 0, a.length - 2); [a[i], a[i + 1]] = [a[i + 1], a[i]]; }
    else { const i = int(r, 0, a.length - 1); a[i] = String((Number(a[i]) + int(r, 1, 8)) % 10); }
    const s = a.join("");
    if (s !== correct) out.add(s);
  }
  return out.size === 3 ? [...out] : null;
}

function digitSequence(r: R, diff: Diff, n: number, reverse: boolean): QDef | null {
  const d = digitsOf(r, n), ans = reverse ? [...d].reverse().join("") : d;
  const wrong = digitWrong(r, ans);
  if (!wrong) return null;
  return {
    cat: "memory", diff,
    prompt: reverse ? "Which option is the digit sequence in REVERSE order?" : "Which option is the digit sequence you saw, in the same order?",
    stimulus: { text: spaced(d) }, stimulusSec: n + 3,
    right: L(spaced(ans)), wrong: wrong.map((w) => L(spaced(w))),
    explanation: reverse ? `The sequence was ${spaced(d)}. Reversed it is ${spaced(ans)}.` : `The sequence was ${spaced(d)}.`,
    mn: {
      prompt: reverse ? "Цифрүүдийн дарааллыг ЭСРЭГ дарааллаар нь үзүүлж буй сонголтыг ол." : "Харсан цифрүүдийн дарааллыг ижил дарааллаар нь үзүүлж буй сонголтыг ол.",
      explanation: reverse ? `Дараалал ${spaced(d)} байсан. Урвуугаар нь ${spaced(ans)}.` : `Дараалал ${spaced(d)} байсан.`,
    },
  };
}

function digitAfter(r: R, diff: Diff, n: number): QDef | null {
  const d = digitsOf(r, n), at = int(r, 0, n - 2), x = d[at], ans = d[at + 1];
  const wrong = shuffle([...d].filter((c) => c !== x && c !== ans), r).slice(0, 3);
  if (wrong.length < 3) return null;
  return {
    cat: "memory", diff,
    prompt: `In the digit sequence you saw, which digit came right after ${x}?`,
    stimulus: { text: spaced(d) }, stimulusSec: n + 3,
    right: L(ans), wrong: wrong.map((w) => L(w)),
    explanation: `The sequence was ${spaced(d)}: after ${x} came ${ans}.`,
    mn: { prompt: `Харсан цифрүүдийн дараалалд ${x} цифрийн дараа аль цифр ирсэн бэ?`, explanation: `Дараалал ${spaced(d)} байсан: ${x} → ${ans}.` },
  };
}

function wordAt(r: R, diff: Diff, n: number): QDef | null {
  const list = shuffle(WORDS, r).slice(0, n), pos = int(r, 1, Math.min(n, 7)), ans = list[pos - 1];
  const others = shuffle(list.filter((w) => w !== ans), r).slice(0, 3);
  return {
    cat: "memory", diff,
    prompt: `Which word was ${ORD[pos - 1]} in the list?`,
    stimulus: { text: list.join(" · ") }, stimulusSec: n + 3,
    right: L(ans), wrong: others.map((w) => L(w)),
    explanation: `The list was: ${list.join(", ")}. The ${ORD[pos - 1]} word was “${ans}”.`,
    mn: {
      prompt: `Жагсаалтын ${ORD_MN[pos - 1]} үг аль байсан бэ?`, stimulus: mnWords(list).join(" · "),
      right: WORD_MN[ans], wrong: mnWords(others),
      explanation: `Жагсаалт: ${mnWords(list).join(", ")}. ${ORD_MN[pos - 1]} үг нь “${WORD_MN[ans]}” байсан.`,
    },
  };
}

function wordNotShown(r: R, diff: Diff, n: number): QDef | null {
  const all = shuffle(WORDS, r).slice(0, n + 1), extra = all.pop()!, list = all;
  const wrong = shuffle(list, r).slice(0, 3);
  return {
    cat: "memory", diff,
    prompt: "Which of these words was NOT in the list?",
    stimulus: { text: list.join(" · ") }, stimulusSec: n + 3,
    right: L(extra), wrong: wrong.map((w) => L(w)),
    explanation: `The list was: ${list.join(", ")}. “${extra}” was not in it.`,
    mn: {
      prompt: "Эдгээр үгсээс аль нь жагсаалтад БАЙГААГҮЙ вэ?", stimulus: mnWords(list).join(" · "),
      right: WORD_MN[extra], wrong: mnWords(wrong),
      explanation: `Жагсаалт: ${mnWords(list).join(", ")}. “${WORD_MN[extra]}” жагсаалтад байгаагүй.`,
    },
  };
}

function letterAt(r: R, diff: Diff, n: number): QDef | null {
  const letters = shuffle(CONSONANTS, r).slice(0, n), pos = int(r, 1, Math.min(n, 7)), ans = letters[pos - 1];
  const wrong = shuffle(letters.filter((l) => l !== ans), r).slice(0, 3);
  return {
    cat: "memory", diff,
    prompt: `Which letter was ${ORD[pos - 1]} in the sequence?`,
    stimulus: { text: letters.join(" ") }, stimulusSec: n + 2,
    right: L(ans), wrong: wrong.map((w) => L(w)),
    explanation: `The sequence was ${letters.join(" ")}. The ${ORD[pos - 1]} letter was ${ans}.`,
    mn: { prompt: `Дарааллын ${ORD_MN[pos - 1]} үсэг аль байсан бэ?`, explanation: `Дараалал ${letters.join(" ")} байсан. ${ORD_MN[pos - 1]} үсэг нь ${ans}.` },
  };
}

function gridPattern(r: R, diff: Diff, sizes: number[], lit: number[]): QDef | null {
  const size = pick(r, sizes), count = pick(r, lit);
  const toMatrix = (cells: number[]): Matrix => Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => (cells.includes(y * size + x) ? 1 : 0)));
  const cells = shuffle([...Array(size * size).keys()], r).slice(0, count);
  const grid = toMatrix(cells);
  const seen = new Set([figKey({ k: "grid", cells: grid })]);
  const wrong: Opt[] = [];
  for (let guard = 0; wrong.length < 3 && guard < 300; guard++) {
    const moved = [...cells];
    moved[int(r, 0, count - 1)] = int(r, 0, size * size - 1); // move one lit square somewhere else
    if (new Set(moved).size !== count) continue;
    const f = { k: "grid" as const, cells: toMatrix(moved), full: true };
    const k = figKey(f);
    if (seen.has(k)) continue;
    seen.add(k);
    wrong.push({ fig: f });
  }
  if (wrong.length < 3) return null;
  const fig = { k: "grid" as const, cells: grid, full: true };
  return {
    cat: "memory", diff,
    prompt: "Which grid matches the pattern of highlighted squares you saw?",
    stimulus: { fig }, stimulusSec: 4 + count,
    right: { fig }, wrong,
    explanation: "The correct grid has exactly the squares that were highlighted; each wrong option moves one square.",
    mn: { prompt: "Харсан тодруулсан нүднүүдийн хэв маяг аль торонд тохирч байна вэ?", explanation: "Зөв тор нь тодруулсан нүднүүдтэй яг ижил; буруу сонголт бүр нэг нүдийг зөөсөн." },
  };
}

type Maker = (r: R, d: Diff) => QDef | null;
const MAKERS: Record<Diff, [Maker, number][]> = {
  1: [[(r, d) => digitSequence(r, d, int(r, 3, 4), false), 6], [(r, d) => wordAt(r, d, 4), 5], [(r, d) => wordNotShown(r, d, 4), 4], [(r, d) => letterAt(r, d, 4), 4], [(r, d) => gridPattern(r, d, [3], [3]), 5]],
  2: [[(r, d) => digitSequence(r, d, 5, false), 5], [(r, d) => digitAfter(r, d, 5), 4], [(r, d) => wordAt(r, d, 5), 5], [(r, d) => wordNotShown(r, d, 5), 3], [(r, d) => letterAt(r, d, 5), 3], [(r, d) => gridPattern(r, d, [3], [4]), 4]],
  3: [[(r, d) => digitSequence(r, d, 4, true), 5], [(r, d) => digitSequence(r, d, 6, false), 3], [(r, d) => wordAt(r, d, 6), 3], [(r, d) => wordNotShown(r, d, 6), 3], [(r, d) => letterAt(r, d, 6), 3], [(r, d) => digitAfter(r, d, 6), 3], [(r, d) => gridPattern(r, d, [3, 4], [5]), 4]],
  4: [[(r, d) => digitSequence(r, d, 5, true), 5], [(r, d) => digitSequence(r, d, 7, false), 3], [(r, d) => wordAt(r, d, 7), 4], [(r, d) => wordNotShown(r, d, 7), 3], [(r, d) => letterAt(r, d, 7), 3], [(r, d) => gridPattern(r, d, [4], [6]), 6]],
  5: [[(r, d) => digitSequence(r, d, int(r, 6, 7), true), 6], [(r, d) => digitSequence(r, d, 8, false), 4], [(r, d) => gridPattern(r, d, [4], [7, 8]), 6], [(r, d) => wordAt(r, d, 7), 3], [(r, d) => wordNotShown(r, d, 7), 3], [(r, d) => letterAt(r, d, 7), 2]],
};

/** 120 questions, grouped by difficulty (24 each), deterministic. */
export function generateMemory(seen: Set<string> = new Set()): QDef[] {
  const r = rng(0x4d454d31); // "MEM1"
  const out: QDef[] = [];
  for (const diff of DIFFS) MAKERS[diff].forEach(([make, n], i) => out.push(...collect(n, seen, () => make(r, diff), `memory ${diff}/${i}`)));
  return out;
}
