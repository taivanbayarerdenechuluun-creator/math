// A real PostgreSQL server for running the whole test-suite against PostgreSQL (no Docker needed):
//   node tests/pg-server.mjs        (leave it running)
// then DATABASE_URL=postgresql://postgres:postgres@localhost:5433/intelliq with the prisma/postgres schema.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const dir = path.join(os.tmpdir(), "intelliq-pg-data");
fs.rmSync(dir, { recursive: true, force: true });
// The database MUST be UTF8: the app stores Mongolian text (initdb would otherwise pick the OS code page, e.g. WIN1252).
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: 5433, persistent: false, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
await pg.initialise();
await pg.start();
await pg.createDatabase("intelliq");
console.log("PostgreSQL ready on localhost:5433, database intelliq");

const stop = async () => { try { await pg.stop(); } finally { process.exit(0); } };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
