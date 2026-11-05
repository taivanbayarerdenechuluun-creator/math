// Build entry for Vercel (package.json "vercel-build"; Vercel runs it instead of "build").
// Production runs on PostgreSQL, so this builds against prisma/postgres/schema.prisma (generated from the SQLite source
// by `npm run db:gen-postgres` and committed), applies the migrations, seeds (idempotent) and then runs `next build`.
//
// Environment (Vercel → Project → Settings → Environment Variables):
//   DATABASE_URL    required, postgresql://… (use the pooled URL, e.g. Neon "-pooler" host with ?pgbouncer=true)
//   DIRECT_URL      optional but recommended: the non-pooled URL, used here for migrations and the seed
//                   (the Neon integration in Vercel provides it as DATABASE_URL_UNPOOLED and POSTGRES_URL_NON_POOLING,
//                   which are used, in that order, when DIRECT_URL is unset)
//   SESSION_SECRET  required, >= 32 random characters
//   see .env.example for APP_URL, MAIL_*, STORAGE_DRIVER=s3 and S3_*
//   SKIP_SEED=1     skip the seed step
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const env = process.env;
const fail = (msg) => { console.error(`\n[vercel-build] ${msg}\n`); process.exit(1); };
const warn = (msg) => console.warn(`[vercel-build] WARNING: ${msg}`);
const directUrl = env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING;

if (!/^postgres(ql)?:\/\//i.test(env.DATABASE_URL ?? ""))
  fail("DATABASE_URL must be a PostgreSQL connection string. SQLite cannot run on Vercel (the filesystem is read-only and not shared between requests). Create a database (for example on Neon or Supabase) and set DATABASE_URL.");
if ((env.SESSION_SECRET ?? "").length < 32)
  fail("SESSION_SECRET must be set to at least 32 random characters (generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\").");

if ((env.STORAGE_DRIVER ?? "local").toLowerCase() !== "s3") warn("STORAGE_DRIVER is not 's3': uploaded avatars and question images would be written to a disk that does not persist on Vercel. Set STORAGE_DRIVER=s3 and the S3_* variables.");
if (!env.MAIL_PROVIDER || env.MAIL_PROVIDER === "console") warn("MAIL_PROVIDER is not smtp/resend: verification and password-reset emails will not be delivered.");
if (!env.APP_URL) warn("APP_URL is not set: links in emails will point to http://localhost:3000.");
if (!directUrl && /pooler|pgbouncer/i.test(env.DATABASE_URL)) warn("DATABASE_URL looks pooled and no direct URL is set: migrations through a pooler can fail. Set DIRECT_URL to the non-pooled URL.");

const bin = (...p) => path.join(root, "node_modules", ...p);
function run(label, script, args, extraEnv = {}) {
  console.log(`\n[vercel-build] ${label}`);
  const r = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: "inherit", env: { ...env, ...extraEnv } });
  if (r.status !== 0) fail(`${label} failed (exit code ${r.status}).`);
}

const schema = ["--schema", "prisma/postgres/schema.prisma"];
const direct = { DATABASE_URL: directUrl || env.DATABASE_URL };

run("generating the Prisma client for PostgreSQL", bin("prisma", "build", "index.js"), ["generate", ...schema]);
run("applying database migrations", bin("prisma", "build", "index.js"), ["migrate", "deploy", ...schema], direct);
if (env.SKIP_SEED !== "1") run("seeding (idempotent: creates what is missing, never overwrites admin edits)", bin("tsx", "dist", "cli.mjs"), ["prisma/seed.ts"], direct);
run("building the app", bin("next", "dist", "bin", "next"), ["build"]);
