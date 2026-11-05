import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAnswer, pickCategory, pickQuestion, targetDifficulty, type AdaptState } from "./engine";
import { score } from "./scoring";

test("staircase: needs two correct in a row to go up", () => {
  let s: AdaptState = {};
  s = applyAnswer(s, "logical", true);
  assert.equal(targetDifficulty(s, "logical"), 3);
  s = applyAnswer(s, "logical", true);
  assert.equal(targetDifficulty(s, "logical"), 4);
  s = applyAnswer(s, "logical", true);
  assert.equal(targetDifficulty(s, "logical"), 4, "streak resets after a step up");
});

test("staircase: one miss steps down and resets the streak; clamps at 1 and 5", () => {
  let s: AdaptState = {};
  s = applyAnswer(s, "a", true);
  s = applyAnswer(s, "a", false);
  assert.deepEqual(s.a, { d: 2, s: 0 });
  s = applyAnswer(s, "a", true); // streak 1 only -> still 2
  assert.equal(s.a.d, 2);
  for (let i = 0; i < 6; i++) s = applyAnswer(s, "a", false);
  assert.equal(s.a.d, 1);
  for (let i = 0; i < 20; i++) s = applyAnswer(s, "a", true);
  assert.equal(s.a.d, 5);
});

test("staircase: categories are independent; non-adaptive stays at 3", () => {
  let s: AdaptState = {};
  s = applyAnswer(applyAnswer(s, "x", true), "x", true);
  assert.equal(targetDifficulty(s, "x"), 4);
  assert.equal(targetDifficulty(s, "y"), 3);
  assert.equal(targetDifficulty(s, "x", false), 3);
});

test("simulated user: stable skill converges near that difficulty (not monotone climb)", () => {
  // User answers correctly iff difficulty <= 3.
  let s: AdaptState = {};
  const seen: number[] = [];
  for (let i = 0; i < 40; i++) {
    const d = targetDifficulty(s, "c");
    seen.push(d);
    s = applyAnswer(s, "c", d <= 3);
  }
  assert.ok(Math.max(...seen) === 4 && Math.min(...seen) >= 3, `levels ${seen.join("")}`);
});

test("category coverage is balanced", () => {
  const cats = ["a", "b", "c"];
  const served: Record<string, number> = {};
  for (let i = 0; i < 9; i++) {
    const c = pickCategory(served, cats)!;
    served[c] = (served[c] ?? 0) + 1;
  }
  assert.deepEqual(served, { a: 3, b: 3, c: 3 });
  assert.equal(pickCategory({ a: 1 }, ["a", "b"], () => 0), "b");
  assert.equal(pickCategory({}, []), null);
});

test("question pick prefers nearest difficulty", () => {
  const qs = [{ difficulty: 1 }, { difficulty: 4 }, { difficulty: 5 }];
  assert.equal(pickQuestion(qs, 3, () => 0)!.difficulty, 4);
  assert.equal(pickQuestion(qs, 5)!.difficulty, 5);
  assert.equal(pickQuestion([], 3), null);
});

test("question pick prefers questions the person has not seen, then repeats only as a last resort", () => {
  const qs = [{ id: "a", difficulty: 3 }, { id: "b", difficulty: 3 }, { id: "c", difficulty: 4 }, { id: "d", difficulty: 5 }];
  const first = () => 0;
  // an unseen question at the target difficulty wins over a seen one at the same difficulty
  assert.equal(pickQuestion(qs, 3, first, new Set(["a"]))!.id, "b");
  // when every question at that difficulty has been seen, the nearest unseen one a step away is served
  assert.equal(pickQuestion(qs, 3, first, new Set(["a", "b"]))!.id, "c");
  // two steps away is too far: a repeat at the target difficulty is better than a question that is far off
  assert.equal(pickQuestion(qs, 3, first, new Set(["a", "b", "c"]))!.difficulty, 3);
  assert.equal(pickQuestion(qs, 3, first, new Set(["a", "b", "c", "d"]))!.difficulty, 3);
  // no history, or ids missing: the plain nearest-difficulty rule
  assert.equal(pickQuestion(qs, 5, first, new Set())!.id, "d");
  assert.equal(pickQuestion([{ difficulty: 2 }, { difficulty: 4 }], 4, first, new Set(["x"]))!.difficulty, 4);
  // with random tie-breaking the seen question is never chosen while unseen ones are one step away
  for (let i = 0; i < 50; i++) {
    const p = pickQuestion(qs, 4, Math.random, new Set(["c"]))!;
    assert.ok(qs.includes(p) && p.id !== "c");
  }
});

test("scoring: counts, accuracy, difficulty weighting", () => {
  const r = score(
    [
      { category: "a", difficulty: 5, correct: true },
      { category: "a", difficulty: 1, correct: false },
      { category: "b", difficulty: 2, correct: true },
      { category: "b", difficulty: 2, correct: null },
    ],
    4,
  );
  assert.equal(r.total, 4);
  assert.equal(r.correct, 2);
  assert.equal(r.incorrect, 1);
  assert.equal(r.unanswered, 1);
  assert.equal(r.accuracy, 50);
  assert.equal(r.performance, 70); // (5+2)/(5+1+2+2) = 0.7
  assert.deepEqual(r.categories.find((c) => c.category === "a"), { category: "a", total: 2, correct: 1, performance: 83.3 });
});

test("scoring: hard-item success outweighs easy-item success; unserved counts against", () => {
  const easy = score([{ category: "a", difficulty: 1, correct: true }, { category: "a", difficulty: 5, correct: false }]);
  const hard = score([{ category: "a", difficulty: 1, correct: false }, { category: "a", difficulty: 5, correct: true }]);
  assert.ok(hard.performance > easy.performance);
  const early = score([{ category: "a", difficulty: 3, correct: true }], 4);
  assert.equal(early.unanswered, 3);
  assert.equal(early.performance, 50); // 3 / (3 + 3 unserved × 1)
});

import { parseWeights, startDifficulty } from "./engine";

test("difficulty range: start is clamped, steps never leave the range", () => {
  const hard = { min: 4, max: 5 };
  assert.equal(startDifficulty(hard), 4);
  assert.equal(targetDifficulty({}, "a", true, hard), 4);
  let s: AdaptState = {};
  for (let i = 0; i < 10; i++) s = applyAnswer(s, "a", false, hard);
  assert.equal(s.a.d, 4, "cannot fall below the range minimum");
  for (let i = 0; i < 10; i++) s = applyAnswer(s, "a", true, hard);
  assert.equal(s.a.d, 5, "cannot rise above the range maximum");
  const easy = { min: 1, max: 2 };
  assert.equal(startDifficulty(easy), 2);
  assert.equal(targetDifficulty({ a: { d: 5, s: 0 } }, "a", true, easy), 2, "stale state is clamped into the range");
  assert.equal(targetDifficulty({}, "a", false, hard), 4, "non-adaptive tests stay at the (clamped) start level");
});

test("category weights give proportional coverage", () => {
  const cats = ["a", "b", "c"];
  const served: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    const c = pickCategory(served, cats, () => 0, { a: 2, b: 1, c: 1 })!;
    served[c] = (served[c] ?? 0) + 1;
  }
  assert.deepEqual(served, { a: 6, b: 3, c: 3 });
  assert.equal(pickCategory({ a: 2, b: 0 }, ["a", "b"], () => 0, { a: 4 }), "b", "unused weighted category not starved");
});

test("weights parsing ignores junk", () => {
  assert.deepEqual(parseWeights('{"a":2,"b":"x","c":-1,"d":0.5}'), { a: 2, d: 0.5 });
  assert.deepEqual(parseWeights("not json"), {});
  assert.deepEqual(parseWeights(null), {});
});
