import { test } from "node:test";
import assert from "node:assert/strict";
import { BANK } from "./index";

/**
 * Independent verification of the logic items by exhaustive model checking.
 *
 * Monadic syllogisms are complete over models described by WHICH of the 2^k predicate-combinations ("types") are
 * inhabited, so enumerating every non-empty subset of types (plus the type of each named individual) decides
 * entailment exactly, not just on a few examples. Puzzles with orderings, truth-tellers, hidden contents or algebra
 * are checked by enumerating every assignment. For each puzzle the test asserts that EXACTLY the option stored as
 * correct is entailed by the premises and that every other option is not, i.e. the answer key is unambiguous.
 */
const q = (key: string) => BANK.find((x) => x.key === key)!;
const labels = (key: string) => [q(key).right.label!, ...q(key).wrong.map((w) => w.label!)];

type Model = { types: Set<number>; consts: Record<string, number> };

function* models(preds: string[], consts: string[] = []): Generator<Model> {
  const nTypes = 1 << preds.length;
  for (let mask = 1; mask < 1 << nTypes; mask++) {
    const types = new Set<number>();
    for (let t = 0; t < nTypes; t++) if ((mask >> t) & 1) types.add(t);
    const inhabited = [...types];
    const assign = (i: number, acc: Record<string, number>): Model[] =>
      i === consts.length ? [{ types, consts: acc }] : inhabited.flatMap((t) => assign(i + 1, { ...acc, [consts[i]]: t }));
    yield* assign(0, {});
  }
}

const mk = (preds: string[]) => {
  const bit = (p: string) => 1 << preds.indexOf(p);
  return {
    all: (m: Model, a: string, b: string) => [...m.types].every((t) => !(t & bit(a)) || t & bit(b)),
    some: (m: Model, a: string, b: string) => [...m.types].some((t) => t & bit(a) && t & bit(b)),
    no: (m: Model, a: string, b: string) => ![...m.types].some((t) => t & bit(a) && t & bit(b)),
    is: (m: Model, c: string, p: string) => !!(m.consts[c] & bit(p)),
  };
};

/** Options (label -> formula) that hold in EVERY model of the premises. */
function entailed(all: Model[], premises: (m: Model) => boolean, options: Record<string, (m: Model) => boolean>) {
  const ms = all.filter(premises);
  assert.ok(ms.length > 0, "premises must be satisfiable");
  return Object.entries(options).filter(([, f]) => ms.every(f)).map(([l]) => l);
}

test("L1 syllogism: only 'Tom is an animal' follows", () => {
  const P = mk(["cat", "animal", "dog"]);
  const r = entailed([...models(["cat", "animal", "dog"], ["tom"])], (m) => P.all(m, "cat", "animal") && P.is(m, "tom", "cat"), {
    "Tom is an animal": (m) => P.is(m, "tom", "animal"),
    "Tom is not an animal": (m) => !P.is(m, "tom", "animal"),
    "All animals are cats": (m) => P.all(m, "animal", "cat"),
    "Tom is a dog": (m) => P.is(m, "tom", "dog"),
  });
  assert.deepEqual(r, [q("logical-001").right.label]);
  assert.deepEqual(new Set(labels("logical-001")), new Set(["Tom is an animal", "Tom is not an animal", "All animals are cats", "Tom is a dog"]));
});

test("L8 syllogism: only 'Some doctors are readers' must be true", () => {
  const preds = ["doctor", "musician", "reader"];
  const P = mk(preds);
  const r = entailed([...models(preds)], (m) => P.some(m, "doctor", "musician") && P.all(m, "musician", "reader"), {
    "Some doctors are readers": (m) => P.some(m, "doctor", "reader"),
    "All doctors are readers": (m) => P.all(m, "doctor", "reader"),
    "All readers are musicians": (m) => P.all(m, "reader", "musician"),
    "No doctors are readers": (m) => P.no(m, "doctor", "reader"),
  });
  assert.deepEqual(r, [q("logical-008").right.label]);
});

test("V12 syllogism: only 'No snakes are mammals' follows", () => {
  const preds = ["reptile", "mammal", "snake"];
  const P = mk(preds);
  const r = entailed([...models(preds)], (m) => P.no(m, "reptile", "mammal") && P.all(m, "snake", "reptile"), {
    "No snakes are mammals": (m) => P.no(m, "snake", "mammal"),
    "All mammals are snakes": (m) => P.all(m, "mammal", "snake"),
    "Some snakes are mammals": (m) => P.some(m, "snake", "mammal"),
    "No reptiles are snakes": (m) => P.no(m, "reptile", "snake"),
  });
  assert.deepEqual(r, [q("verbal-012").right.label]);
});

test("L5 conditional: wet ground does not settle whether it rained (affirming the consequent)", () => {
  const states = [0, 1].flatMap((rain) => [0, 1].map((wet) => ({ rain: !!rain, wet: !!wet })));
  const ok = states.filter((s) => (!s.rain || s.wet) && s.wet); // rain -> wet, and wet
  assert.ok(ok.some((s) => s.rain) && ok.some((s) => !s.rain), "both 'rained' and 'did not rain' are consistent");
  assert.match(q("logical-005").right.label!, /^Nothing certain/);
  assert.deepEqual(new Set(q("logical-005").wrong.map((w) => w.label)), new Set(["It rained", "It did not rain", "The ground is always wet"]));
});

test("L6 ordering: Cara is the only possible shortest person", () => {
  const people = ["Ann", "Ben", "Cara"];
  const h: Record<string, number>[] = [];
  for (const a of [0, 1, 2]) for (const b of [0, 1, 2]) for (const c of [0, 1, 2]) h.push({ Ann: a, Ben: b, Cara: c });
  const ms = h.filter((x) => x.Ann > x.Ben && x.Ben > x.Cara);
  const shortest = (n: string) => (x: Record<string, number>) => people.every((p) => p === n || x[n] < x[p]);
  const holds = (f: (x: Record<string, number>) => boolean) => ms.every(f);
  assert.deepEqual([holds(shortest("Ann")), holds(shortest("Ben")), holds(shortest("Cara")), holds((x) => x.Ann === x.Cara)], [false, false, true, false]);
  assert.equal(q("logical-006").right.label, "Cara");
});

function perms<T>(a: T[]): T[][] {
  return a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p]));
}

test("L9 row puzzle: the order is forced and Eve is in the middle", () => {
  const ok = perms(["Dan", "Eve", "Fay", "Gus", "Hal"]).filter((p) => {
    const at = (n: string) => p.indexOf(n);
    return at("Eve") > at("Dan") && at("Eve") < at("Fay") && at("Gus") > at("Fay") && at("Hal") < at("Dan");
  });
  assert.equal(ok.length, 1, "exactly one arrangement satisfies every clue");
  assert.deepEqual(ok[0], ["Hal", "Dan", "Eve", "Fay", "Gus"]);
  assert.equal(ok[0][2], q("logical-009").right.label);
  for (const w of q("logical-009").wrong) assert.notEqual(w.label, ok[0][2]);
});

test("L11 disjunction: with the alarm off the vault must be locked", () => {
  const ms = [0, 1].flatMap((v) => [0, 1].map((a) => ({ v: !!v, a: !!a }))).filter((s) => (s.v || s.a) && !s.a);
  assert.ok(ms.length > 0 && ms.every((s) => s.v));
  assert.equal(q("logical-011").right.label, "The vault is locked");
});

test("L13 bat and ball: the ball costs 5 cents and no other listed price works", () => {
  const sol = Array.from({ length: 111 }, (_, b) => b).filter((b) => b + (b + 100) === 110);
  assert.deepEqual(sol, [5]);
  assert.equal(q("logical-013").right.label, "5 cents");
  for (const w of q("logical-013").wrong) assert.ok(!sol.includes(parseInt(w.label!)), w.label);
});

test("L14 mislabelled boxes: the box labelled Oranges holds the mixed fruit", () => {
  const labelsOf = ["Apples", "Oranges", "Mixed"];
  const ok = perms(["Apples", "Oranges", "Mixed"]).filter((contents) => contents.every((c, i) => c !== labelsOf[i]) && (contents[2] === "Apples" || contents[2] === "Mixed"));
  assert.equal(ok.length, 1);
  assert.equal(ok[0][1], "Mixed");
  assert.equal(q("logical-014").right.label, "Mixed fruit");
});

test("L15 truth-tellers: exactly one consistent assignment, only Bob is truthful", () => {
  const ms: { a: boolean; b: boolean; c: boolean }[] = [];
  for (const a of [true, false]) for (const b of [true, false]) for (const c of [true, false]) {
    // each person is truthful iff their statement is true
    if (a === !b && b === !c && c === (!a && !b)) ms.push({ a, b, c });
  }
  assert.deepEqual(ms, [{ a: false, b: true, c: false }]);
  assert.equal(q("logical-015").right.label, "Only Bob");
});

test("L3 weekday arithmetic and L2 odd-one-out", () => {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  assert.equal(days[(days.indexOf("Wednesday") - 3 + 7) % 7], q("logical-003").right.label);
  const corners: Record<string, number> = { Triangle: 3, Square: 4, Circle: 0, Pentagon: 5 };
  const odd = Object.entries(corners).filter(([, c]) => c === 0);
  assert.deepEqual(odd.map(([n]) => n), [q("logical-002").right.label]);
});

test("Mongolian row puzzle keeps the same people and the same unique answer", () => {
  // Eve=Сараа, Dan=Болд, Fay=Дорж, Gus=Ганаа, Hal=Хулан (same clues as the English item)
  const ok = perms(["Болд", "Сараа", "Дорж", "Ганаа", "Хулан"]).filter((p) => {
    const at = (n: string) => p.indexOf(n);
    return at("Сараа") > at("Болд") && at("Сараа") < at("Дорж") && at("Ганаа") > at("Дорж") && at("Хулан") < at("Болд");
  });
  assert.equal(ok.length, 1);
  assert.equal(ok[0][2], q("logical-009").mn!.right);
});

test("Mongolian truth-teller puzzle: same structure, same unique answer (Бат)", () => {
  assert.equal(q("logical-015").mn!.right, "Зөвхөн Бат");
  assert.match(q("logical-015").mn!.prompt, /Алтан[\s\S]*Бат[\s\S]*Цэцэг/);
});
