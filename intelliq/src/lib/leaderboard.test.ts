import { test } from "node:test";
import assert from "node:assert/strict";
import { displayName, rankEntries, sinceFor } from "./leaderboard";

const c = (userId: string, value: number, accuracy = 50, at = 1) => ({ userId, value, accuracy, at });

test("best result per user, sorted descending, attempts counted", () => {
  const r = rankEntries([c("a", 60), c("a", 80), c("b", 70), c("a", 50)]);
  assert.deepEqual(r.map((x) => [x.userId, x.rank, x.value, x.attempts]), [["a", 1, 80, 3], ["b", 2, 70, 1]]);
});

test("ties share a rank; accuracy then earlier time break order", () => {
  const r = rankEntries([c("a", 70, 60, 5), c("b", 70, 60, 3), c("c", 70, 55, 1), c("d", 60)]);
  assert.deepEqual(r.map((x) => [x.userId, x.rank]), [["b", 1], ["a", 1], ["c", 3], ["d", 4]]);
});

test("empty input and single entry", () => {
  assert.deepEqual(rankEntries([]), []);
  assert.equal(rankEntries([c("x", 10)])[0].rank, 1);
});

test("periods", () => {
  const now = Date.UTC(2026, 9, 31);
  assert.equal(sinceFor("global", now), null);
  assert.equal(sinceFor("weekly", now)!.toISOString().slice(0, 10), "2026-10-24");
  assert.equal(sinceFor("monthly", now)!.toISOString().slice(0, 10), "2026-10-01");
});

test("public name is first name only", () => {
  assert.equal(displayName("Badma Arag Bat"), "Badma");
  assert.equal(displayName("  "), "Anonymous");
  assert.equal(displayName("A".repeat(50)).length, 20);
  assert.ok(!displayName("jane@example.com Doe").includes("Doe"));
});
