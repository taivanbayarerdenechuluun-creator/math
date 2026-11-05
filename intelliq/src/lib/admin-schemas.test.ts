import { test } from "node:test";
import assert from "node:assert/strict";
import { assessmentSchema, questionSchema, roleSchema } from "./admin-schemas";

const base = {
  categorySlug: "logical", prompt: "Which one?", difficulty: 3, explanation: "Because.",
  options: [{ label: "A", isCorrect: true }, { label: "B", isCorrect: false }, { label: "C", isCorrect: false }],
};
const bad = (patch: object) => questionSchema.safeParse({ ...base, ...patch });
const msgs = (r: ReturnType<typeof bad>) => (r.success ? [] : r.error.issues.map((i) => i.message));

test("a valid text question parses with defaults", () => {
  const r = questionSchema.parse(base);
  assert.equal(r.active, true);
  assert.equal(r.timeLimitSec, null);
  assert.equal(r.figure, null);
});

test("exactly one correct option", () => {
  assert.ok(msgs(bad({ options: base.options.map((o) => ({ ...o, isCorrect: false })) })).includes("Exactly one option must be marked correct"));
  assert.ok(msgs(bad({ options: base.options.map((o) => ({ ...o, isCorrect: true })) })).includes("Exactly one option must be marked correct"));
});

test("option count, emptiness and duplicates", () => {
  assert.equal(bad({ options: [{ label: "A", isCorrect: true }] }).success, false);
  assert.ok(msgs(bad({ options: [{ label: "A", isCorrect: true }, { label: "a", isCorrect: false }] })).includes("Options must be distinct"));
  assert.ok(msgs(bad({ options: [{ label: "", isCorrect: true }, { label: "B", isCorrect: false }] })).includes("Each option needs a label or a figure"));
});

test("difficulty and field bounds", () => {
  for (const d of [0, 6, 2.5]) assert.equal(bad({ difficulty: d }).success, false, `difficulty ${d}`);
  assert.equal(bad({ prompt: "x" }).success, false);
  assert.equal(bad({ prompt: "x".repeat(1001) }).success, false);
  assert.equal(bad({ timeLimitSec: 2 }).success, false);
});

test("figure specs are strictly validated", () => {
  const g = { k: "glyph", shape: "arrow", rot: 90 };
  assert.equal(bad({ figure: g }).success, true);
  assert.equal(bad({ figure: { ...g, shape: "<script>" } }).success, false);
  assert.equal(bad({ figure: { ...g, extra: "x" } }).success, false, "unknown keys rejected");
  assert.equal(bad({ figure: { k: "grid", cells: [[1, 0], [1]] } }).success, false, "ragged grid");
  assert.equal(bad({ figure: { k: "grid", cells: [[0, 0]] } }).success, false, "empty grid");
  assert.equal(bad({ figure: { k: "grid", cells: Array.from({ length: 9 }, () => [1]) } }).success, false, "grid too tall");
  assert.equal(bad({ figure: { k: "grid", cells: [[2]] } }).success, false, "cells must be 0/1");
  assert.equal(bad({ figure: { k: "seq", items: [g, null] } }).success, true);
  assert.equal(bad({ figure: { k: "seq", items: [g] } }).success, false);
});

test("stimulus needs a duration and content", () => {
  assert.equal(bad({ stimulus: { text: "7 3 1" }, stimulusSec: 5 }).success, true);
  assert.equal(bad({ stimulus: { text: "7 3 1" } }).success, false);
  assert.equal(bad({ stimulusSec: 5 }).success, false);
  assert.equal(bad({ stimulus: {}, stimulusSec: 5 }).success, false);
});

test("image url must be an uploaded asset (no external or traversal URLs)", () => {
  const ok = "/api/assets/" + "a".repeat(32) + ".png";
  assert.equal(bad({ imageUrl: ok }).success, true);
  for (const u of ["https://evil.example/x.png", "/api/assets/../../etc/passwd", "javascript:alert(1)", "/api/assets/" + "a".repeat(32) + ".svg"]) assert.equal(bad({ imageUrl: u }).success, false, u);
});

test("assessment and role validation", () => {
  const a = { slug: "my-test", titleEn: "Mine", titleMn: "Минийх", descEn: "desc", descMn: "тайлбар", questionCount: 10 };
  assert.equal(assessmentSchema.safeParse(a).success, true);
  assert.equal(assessmentSchema.safeParse({ ...a, slug: "Bad Slug!" }).success, false);
  assert.equal(assessmentSchema.safeParse({ ...a, questionCount: 1 }).success, false);
  assert.equal(roleSchema.safeParse({ name: "MODERATOR" }).success, true);
  assert.equal(roleSchema.safeParse({ name: "admin" }).success, false);
});
