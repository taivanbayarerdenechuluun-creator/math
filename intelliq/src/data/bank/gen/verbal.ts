import { L, rng, shuffle, type QDef } from "../types";
import { ANTONYMS, CAPITALS, CATEGORIES, EASY_ANTONYMS, PART_WHOLE, TOOL_USER, YOUNG, type Category, type T } from "./lexicon";
import { DIFFS, collect, pick, type Diff, type R } from "./util";

/*
 * 120 generated verbal-reasoning questions (24 per difficulty), built from the vocabulary tables in ./lexicon.ts:
 * opposites, "A is to B as C is to …" analogies (opposites, categories, parts, young animals, capitals, tools and
 * their users), "which of these is a …" and odd-one-out. The Mongolian items are adapted to Mongolian vocabulary
 * (never an English vocabulary test in disguise) and avoid case suffixes on variable words, whose form depends on
 * the word, by using the pair notation «a» — «b».
 */

function build(diff: Diff, prompt: T, right: T, wrong: T[], expl: T): QDef {
  return {
    cat: "verbal", diff, prompt: prompt.en, right: L(right.en), wrong: wrong.map((w) => L(w.en)), explanation: expl.en,
    mn: { prompt: prompt.mn, right: right.mn, wrong: wrong.map((w) => w.mn), explanation: expl.mn },
  };
}

const q2 = (x: T) => `“${x.en}”`;
const guill = (x: T) => `«${x.mn}»`;
const ratio = (a: T, b: T, c: T): T => ({
  en: `${a.en.charAt(0).toUpperCase()}${a.en.slice(1)} is to ${b.en} as ${c.en} is to …`,
  mn: `${guill(a)} ба ${guill(b)} хоёрын харьцаа нь ${guill(c)} ба … хоёрын харьцаатай адил. Хоосон зайг нөхөх үгийг сонго.`,
});

/** `n` distinct entries of `pool` that are not in `not` (by English text), in random order. */
function sample<X extends T>(r: R, pool: readonly X[], n: number, not: T[] = []): X[] {
  const banned = new Set(not.map((x) => x.en));
  return shuffle(pool.filter((x) => !banned.has(x.en)), r).slice(0, n);
}

// ---------------------------------------------------------------- opposites

function oppositeOf(r: R, diff: Diff): QDef | null {
  const pool = ANTONYMS.slice(0, EASY_ANTONYMS);
  const [x, y] = pick(r, pool), flip = r() < 0.5;
  const [word, opp] = flip ? [y, x] : [x, y];
  const wrong = sample(r, pool.flat(), 3, [word, opp]);
  return build(diff,
    { en: `Which word means the OPPOSITE of ${q2(word)}?`, mn: `${guill(word)} гэдэг үгийн ЭСРЭГ утгатай үгийг сонго.` },
    opp, wrong,
    { en: `${q2(word)} and ${q2(opp)} are opposites.`, mn: `${guill(word)} ба ${guill(opp)} нь эсрэг утгатай.` });
}

function antonymAnalogy(r: R, diff: Diff): QDef | null {
  const pool = diff >= 5 ? ANTONYMS : ANTONYMS.slice(0, EASY_ANTONYMS);
  const [p1, p2] = shuffle(pool, r).slice(0, 2);
  const f1 = r() < 0.5, f2 = r() < 0.5;
  const [a, b] = f1 ? [p1[1], p1[0]] : p1, [c, d] = f2 ? [p2[1], p2[0]] : p2;
  // a trap (the answer to the first pair), and, at the hardest level, words of the same kind
  const same = pool.flat().filter((w) => w.en !== c.en && w.en !== d.en && w.en !== b.en);
  const wrong = [b, ...sample(r, same, 2, [d])];
  return build(diff, ratio(a, b, c), d, wrong,
    { en: `${a.en} and ${b.en} are opposites, so the opposite of ${c.en} is ${d.en}.`, mn: `Эсрэг утгатай хос: ${guill(a)} — ${guill(b)}, ${guill(c)} — ${guill(d)}.` });
}

// ---------------------------------------------------------------- categories

const SIMPLE = ["animal", "fruit", "colour", "vehicle", "body"];
const nested = (a: Category, b: Category) => (a.key === "animal" && b.key === "bird") || (a.key === "bird" && b.key === "animal");

function memberOf(r: R, diff: Diff): QDef | null {
  const cats = diff === 1 ? CATEGORIES.filter((c) => SIMPLE.includes(c.key)) : CATEGORIES;
  const cat = pick(r, cats), right = pick(r, cat.members);
  const others = CATEGORIES.filter((c) => c.key !== cat.key && !nested(cat, c));
  const picks = shuffle(others, r).slice(0, 3);
  const wrong = picks.map((c) => pick(r, c.members));
  return build(diff,
    { en: `Which of these is ${cat.article}?`, mn: `Дараахаас аль нь ${cat.name.mn.toLowerCase()} вэ?` },
    right, wrong,
    { en: `${q2(right)} is ${cat.article}; the other words belong to other groups.`, mn: `${guill(right)} бол ${cat.name.mn.toLowerCase()}; бусад үгс өөр бүлэгт хамаарна.` });
}

function categoryAnalogy(r: R, diff: Diff): QDef | null {
  const [A, B] = shuffle(CATEGORIES, r).slice(0, 2);
  if (nested(A, B)) return null;
  const x = pick(r, A.members), y = pick(r, B.members);
  const wrong = [A.name, ...sample(r, CATEGORIES.filter((c) => c.key !== B.key && c.key !== A.key && !nested(B, c)).map((c) => c.name), 2)];
  return build(diff, ratio(x, A.name, y), B.name, wrong,
    { en: `${x.en} belongs to the group “${A.name.en}”, and ${y.en} belongs to “${B.name.en}”.`, mn: `${guill(x)} нь ${guill(A.name)} бүлэгт, ${guill(y)} нь ${guill(B.name)} бүлэгт хамаарна.` });
}

function oddOne(r: R, diff: Diff): QDef | null {
  const HARD: [string, string][] = [["fruit", "vegetable"], ["vegetable", "fruit"], ["tool", "furniture"], ["furniture", "tool"], ["instrument", "tool"], ["tool", "instrument"]];
  let A: Category, B: Category;
  if (diff >= 5) {
    const [ka, kb] = pick(r, HARD);
    A = CATEGORIES.find((c) => c.key === ka)!; B = CATEGORIES.find((c) => c.key === kb)!;
  } else {
    [A, B] = shuffle(CATEGORIES.filter((c) => c.members.length >= 3), r).slice(0, 2);
    if (nested(A, B) || HARD.some(([ka, kb]) => ka === A.key && kb === B.key)) return null;
  }
  if (A.members.length < 3) return null;
  const same = shuffle(A.members, r).slice(0, 3), odd = pick(r, B.members);
  const list = shuffle([...same, odd], r);
  return build(diff,
    { en: `Which word does not belong with the others?  ${list.map((x) => x.en).join(", ")}`, mn: `Аль үг бусдадаа нийцэхгүй байна вэ?  ${list.map((x) => x.mn).join(", ")}` },
    odd, same,
    { en: `${same.map((x) => x.en).join(", ")} are all in the group “${A.name.en}”; ${odd.en} is in “${B.name.en}”.`, mn: `${same.map((x) => x.mn).join(", ")} нь бүгд ${guill(A.name)} бүлэгт; ${guill(odd)} нь ${guill(B.name)} бүлэгт.` });
}

// ---------------------------------------------------------------- pairs

function pairAnalogy(r: R, diff: Diff, pairs: [T, T][], note: (p: [T, T], q: [T, T]) => T, trapFirst: boolean): QDef | null {
  const [p, q] = shuffle(pairs, r).slice(0, 2);
  const rest = pairs.map((x) => x[1]).filter((x) => x.en !== q[1].en && x.en !== p[1].en);
  const wrong = trapFirst ? [p[1], ...sample(r, rest, 2)] : sample(r, [...rest, p[1]], 3);
  return build(diff, ratio(p[0], p[1], q[0]), q[1], wrong, note(p, q));
}

const youngAnalogy = (r: R, d: Diff) => pairAnalogy(r, d, YOUNG, (p, q) => ({ en: `A ${p[1].en} is a young ${p[0].en}, and a ${q[1].en} is a young ${q[0].en}.`, mn: `Үр төл: ${guill(p[0])} — ${guill(p[1])}, ${guill(q[0])} — ${guill(q[1])}.` }), true);
const partWhole = (r: R, d: Diff) => pairAnalogy(r, d, PART_WHOLE, (p, q) => ({ en: `A ${p[0].en} is part of a ${p[1].en}, and a ${q[0].en} is part of a ${q[1].en}.`, mn: `Хэсэг — бүхэл: ${guill(p[0])} — ${guill(p[1])}, ${guill(q[0])} — ${guill(q[1])}.` }), true);
const capitalAnalogy = (r: R, d: Diff) => pairAnalogy(r, d, CAPITALS, (p, q) => ({ en: `The capital of ${p[0].en} is ${p[1].en}, so the capital of ${q[0].en} is ${q[1].en}.`, mn: `Нийслэл: ${guill(p[0])} — ${guill(p[1])}, ${guill(q[0])} — ${guill(q[1])}.` }), d >= 5 ? false : true);
const toolUser = (r: R, d: Diff) => pairAnalogy(r, d, TOOL_USER, (p, q) => ({ en: `A ${p[0].en} is used by a ${p[1].en}, and a ${q[0].en} by a ${q[1].en}.`, mn: `Багаж — эзэн: ${guill(p[0])} — ${guill(p[1])}, ${guill(q[0])} — ${guill(q[1])}.` }), true);

// ---------------------------------------------------------------- assembly

const MAKERS: Record<Diff, [(r: R, d: Diff) => QDef | null, number][]> = {
  1: [[oppositeOf, 16], [memberOf, 8]],
  2: [[antonymAnalogy, 8], [memberOf, 8], [youngAnalogy, 8]],
  3: [[categoryAnalogy, 8], [partWhole, 8], [oddOne, 8]],
  4: [[oddOne, 8], [capitalAnalogy, 8], [toolUser, 8]],
  5: [[oddOne, 8], [antonymAnalogy, 8], [capitalAnalogy, 8]],
};

/** 120 questions, grouped by difficulty (24 each), deterministic. */
export function generateVerbal(seen: Set<string> = new Set()): QDef[] {
  const r = rng(0x56455231); // "VER1"
  const out: QDef[] = [];
  for (const diff of DIFFS) {
    MAKERS[diff].forEach(([make, n], i) => out.push(...collect(n, seen, () => make(r, diff), `verbal ${diff}/${i}`)));
  }
  return out;
}
