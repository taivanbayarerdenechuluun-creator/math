import { test } from "node:test";
import assert from "node:assert/strict";
import { containsCI, usesPostgres } from "./db-compat";

test("the database is recognised from DATABASE_URL", () => {
  assert.equal(usesPostgres("postgresql://u:p@localhost:5432/intelliq"), true);
  assert.equal(usesPostgres("postgres://u:p@host/db"), true);
  assert.equal(usesPostgres("file:./dev.db"), false);
  assert.equal(usesPostgres(""), false);
});

test("case-insensitive search needs mode=insensitive on PostgreSQL only", () => {
  assert.deepEqual(containsCI("Quick", "postgresql://x/y"), { contains: "Quick", mode: "insensitive" });
  assert.deepEqual(containsCI("Quick", "file:./dev.db"), { contains: "Quick" }, "SQLite rejects the mode argument");
});
