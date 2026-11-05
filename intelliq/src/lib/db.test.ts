import { test } from "node:test";
import assert from "node:assert/strict";
import { runtimeDatabaseUrl, stripNul } from "./db";

test("pooled PostgreSQL URLs get pgbouncer and a connect timeout; every other URL is left alone", () => {
  const pooled = "postgresql://u:p@ep-cool-123-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require";
  const out = new URL(runtimeDatabaseUrl(pooled)!);
  assert.equal(out.searchParams.get("sslmode"), "require");
  assert.equal(out.searchParams.get("pgbouncer"), "true");
  assert.equal(out.searchParams.get("connect_timeout"), "15");
  assert.equal(out.hostname, "ep-cool-123-pooler.eu-central-1.aws.neon.tech");
  assert.equal(runtimeDatabaseUrl(runtimeDatabaseUrl(pooled)), runtimeDatabaseUrl(pooled), "applying it twice changes nothing");
  const own = "postgresql://u:p@ep-x-pooler.neon.tech/db?pgbouncer=true&connect_timeout=30";
  assert.equal(runtimeDatabaseUrl(own), own, "options the owner set are kept");
  const direct = "postgresql://u:p@ep-cool-123.eu-central-1.aws.neon.tech/neondb?sslmode=require";
  assert.equal(runtimeDatabaseUrl(direct), direct, "a direct URL is not pooled");
  assert.equal(runtimeDatabaseUrl("file:./dev.db"), "file:./dev.db");
  assert.equal(runtimeDatabaseUrl(undefined), undefined);
  assert.equal(runtimeDatabaseUrl("postgresql://u:p@host:6543/db?pgbouncer=true")?.includes("connect_timeout=15"), true);
  assert.equal(runtimeDatabaseUrl("postgresql://not a url"), "postgresql://not a url");
});

test("NUL bytes are removed from every string in query arguments, and nothing else changes", () => {
  const when = new Date();
  const buf = Buffer.from([0, 1, 2]);
  const out = stripNul({ where: { id: "ab\u0000c", OR: [{ email: { contains: "\u0000x" } }, { name: "plain" }] }, data: { n: 5, ok: true, none: null, when, buf, tags: ["a\u0000", "b"] } }) as { where: { id: string; OR: { email?: { contains: string }; name?: string }[] }; data: { tags: string[]; n: number; ok: boolean; none: null; when: Date; buf: Buffer } };
  assert.equal(out.where.id, "abc");
  assert.equal(out.where.OR[0].email?.contains, "x");
  assert.equal(out.where.OR[1].name, "plain");
  assert.deepEqual(out.data.tags, ["a", "b"]);
  assert.equal(out.data.n, 5);
  assert.equal(out.data.ok, true);
  assert.equal(out.data.none, null);
  assert.equal(out.data.when, when, "Dates keep their identity");
  assert.equal(out.data.buf, buf, "Buffers are untouched");
  assert.equal(stripNul("\u0000\u0000"), "");
  assert.equal(stripNul("no nul"), "no nul");
});
