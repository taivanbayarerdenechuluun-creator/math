import type { Matrix } from "../../lib/figures";
import { rng, shuffle, L, type Opt, type QDef } from "./types";
import { ORD_MN, WORD_MN } from "./mn";

// NOTE: the order of `rand` calls below defines the seeded bank. Do not reorder them: existing databases were
// seeded with this exact sequence, and bank.test.ts / the seed backfill match questions by content.
const rand = rng(777);

function digits(n: number): string {
  // Distinct digits keep adjacent-swap distractors always different from the answer.
  return shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 0], rand).slice(0, n).join("");
}
const spaced = (s: string) => s.split("").join(" ");

function digitDistractors(correct: string): string[] {
  const out = new Set<string>();
  const arr = correct.split("");
  let guard = 0;
  while (out.size < 3 && guard++ < 200) {
    const a = arr.slice();
    if (out.size % 2 === 0) {
      const i = Math.floor(rand() * (a.length - 1));
      [a[i], a[i + 1]] = [a[i + 1], a[i]];
    } else {
      const i = Math.floor(rand() * a.length);
      a[i] = String((Number(a[i]) + 1 + Math.floor(rand() * 8)) % 10);
    }
    const s = a.join("");
    if (s !== correct) out.add(s);
  }
  return [...out];
}

const digitQ = (diff: QDef["diff"], n: number, reverse: boolean): QDef => {
  const d = digits(n);
  const ans = reverse ? d.split("").reverse().join("") : d;
  return {
    cat: "memory",
    diff,
    prompt: reverse ? "Which option is the digit sequence in REVERSE order?" : "Which option is the digit sequence you saw, in the same order?",
    stimulus: { text: spaced(d) },
    stimulusSec: n + 3,
    right: L(spaced(ans)),
    wrong: digitDistractors(ans).map(spaced).map(L),
    explanation: reverse ? `The sequence was ${spaced(d)}. Reversed it is ${spaced(ans)}.` : `The sequence was ${spaced(d)}.`,
    mn: {
      prompt: reverse ? "Цифрүүдийн дарааллыг ЭСРЭГ дарааллаар нь үзүүлж буй сонголтыг ол." : "Харсан цифрүүдийн дарааллыг ижил дарааллаар нь үзүүлж буй сонголтыг ол.",
      explanation: reverse ? `Дараалал ${spaced(d)} байсан. Урвуугаар нь ${spaced(ans)}.` : `Дараалал ${spaced(d)} байсан.`,
    },
  };
};

const WORDS = ["apple", "river", "chair", "tiger", "cloud", "piano", "lemon", "bridge", "candle", "forest", "mirror", "pencil", "garden", "ladder", "violin", "orange", "window", "rocket", "anchor", "basket"];
function pickWords(n: number): string[] {
  return shuffle(WORDS, rand).slice(0, n);
}
const mnWords = (list: string[]) => list.map((w) => WORD_MN[w]);

const notShown = (diff: QDef["diff"], n: number): QDef => {
  const shown = pickWords(n + 1);
  const extra = shown.pop()!;
  const list = shown;
  const wrong = shuffle(list, rand).slice(0, 3);
  return {
    cat: "memory",
    diff,
    prompt: "Which of these words was NOT in the list?",
    stimulus: { text: list.join(" · ") },
    stimulusSec: n + 3,
    right: L(extra),
    wrong: wrong.map(L),
    explanation: `The list was: ${list.join(", ")}. “${extra}” was not in it.`,
    mn: {
      prompt: "Эдгээр үгсээс аль нь жагсаалтад БАЙГААГҮЙ вэ?",
      stimulus: mnWords(list).join(" · "),
      right: WORD_MN[extra],
      wrong: mnWords(wrong),
      explanation: `Жагсаалт: ${mnWords(list).join(", ")}. “${WORD_MN[extra]}” жагсаалтад байгаагүй.`,
    },
  };
};

const ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh"];
const wordAt = (diff: QDef["diff"], n: number, pos: number): QDef => {
  const list = pickWords(n);
  const ans = list[pos - 1];
  const others = shuffle(list.filter((w) => w !== ans), rand).slice(0, 3);
  return {
    cat: "memory",
    diff,
    prompt: `Which word was ${ORD[pos - 1]} in the list?`,
    stimulus: { text: list.join(" · ") },
    stimulusSec: n + 3,
    right: L(ans),
    wrong: others.map(L),
    explanation: `The list was: ${list.join(", ")}. The ${ORD[pos - 1]} word was “${ans}”.`,
    mn: {
      prompt: `Жагсаалтын ${ORD_MN[pos - 1]} үг аль байсан бэ?`,
      stimulus: mnWords(list).join(" · "),
      right: WORD_MN[ans],
      wrong: mnWords(others),
      explanation: `Жагсаалт: ${mnWords(list).join(", ")}. ${ORD_MN[pos - 1]} үг нь “${WORD_MN[ans]}” байсан.`,
    },
  };
};

const letterAt = (diff: QDef["diff"], n: number, pos: number): QDef => {
  const letters = shuffle("BCDFGHJKLMNPQRSTVWXZ".split(""), rand).slice(0, n);
  const ans = letters[pos - 1];
  const wrong = shuffle(letters.filter((l) => l !== ans), rand).slice(0, 3);
  return {
    cat: "memory",
    diff,
    prompt: `Which letter was ${ORD[pos - 1]} in the sequence?`,
    stimulus: { text: letters.join(" ") },
    stimulusSec: n + 2,
    right: L(ans),
    wrong: wrong.map(L),
    explanation: `The sequence was ${letters.join(" ")}. The ${ORD[pos - 1]} letter was ${ans}.`,
    mn: {
      prompt: `Дарааллын ${ORD_MN[pos - 1]} үсэг аль байсан бэ?`,
      explanation: `Дараалал ${letters.join(" ")} байсан. ${ORD_MN[pos - 1]} үсэг нь ${ans}.`,
    },
  };
};

function litGrid(size: number, lit: number): Matrix {
  const cells = shuffle([...Array(size * size).keys()], rand).slice(0, lit);
  return Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => (cells.includes(r * size + c) ? 1 : 0)));
}
function moveOne(m: Matrix): Matrix {
  const size = m.length;
  const flat = m.flat();
  const on = flat.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const off = flat.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  flat[on[Math.floor(rand() * on.length)]] = 0;
  flat[off[Math.floor(rand() * off.length)]] = 1;
  return Array.from({ length: size }, (_, r) => flat.slice(r * size, r * size + size));
}
const patternQ = (diff: QDef["diff"], size: number, lit: number): QDef => {
  const grid = litGrid(size, lit);
  const seen = new Set([grid.flat().join("")]);
  const wrong: Opt[] = [];
  let guard = 0;
  while (wrong.length < 3 && guard++ < 200) {
    const m = moveOne(grid);
    const k = m.flat().join("");
    if (seen.has(k)) continue;
    seen.add(k);
    wrong.push({ fig: { k: "grid", cells: m, full: true } });
  }
  return {
    cat: "memory",
    diff,
    prompt: "Which grid matches the pattern of highlighted squares you saw?",
    stimulus: { fig: { k: "grid", cells: grid, full: true } },
    stimulusSec: 4 + lit,
    right: { fig: { k: "grid", cells: grid, full: true } },
    wrong,
    explanation: "The correct grid has exactly the squares that were highlighted; each wrong option moves one square.",
    mn: {
      prompt: "Харсан тодруулсан нүднүүдийн хэв маяг аль торонд тохирч байна вэ?",
      explanation: "Зөв тор нь тодруулсан нүднүүдтэй яг ижил; буруу сонголт бүр нэг нүдийг зөөсөн.",
    },
  };
};

export const memory: QDef[] = [
  digitQ(1, 4, false),
  notShown(1, 4),
  digitQ(1, 5, false),
  digitQ(2, 6, false),
  patternQ(2, 3, 3),
  wordAt(2, 5, 2),
  digitQ(3, 5, true),
  patternQ(3, 3, 5),
  letterAt(3, 6, 4),
  digitQ(4, 6, true),
  patternQ(4, 4, 6),
  wordAt(4, 7, 4),
  digitQ(5, 8, false),
  digitQ(5, 7, true),
  patternQ(5, 4, 8),
];
