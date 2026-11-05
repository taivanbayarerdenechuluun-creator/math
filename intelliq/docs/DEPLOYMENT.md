# Deployment

## Checklist
1. **Secrets:** set `SESSION_SECRET` (>= 32 random chars). The app refuses to issue sessions without it.
2. **Database:** use PostgreSQL (below), created with **UTF8** encoding. SQLite is for development only.
3. **HTTPS:** terminate TLS in front of the app. Cookies are `Secure` and HSTS is sent in production.
4. **Public URL:** set `APP_URL`; it is the base of the links in verification and reset emails.
5. **Email:** set `MAIL_PROVIDER=smtp` (with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) or `resend`
   (with `RESEND_API_KEY`), plus `MAIL_FROM`. See "Email" below. Without a provider nothing is sent in production.
6. **First admin:** register normally, then on the server run `npm run make-admin -- you@example.com`.
7. **Uploads:** `STORAGE_DRIVER=local` writes to `./storage` (mount a persistent volume); `STORAGE_DRIVER=s3` uses any
   S3-compatible service. See "File storage" below.
8. **Rate limiting:** the built-in limiter is in-memory (per instance). Behind several instances use a shared store
   (e.g. Upstash/Redis) in `src/lib/rate-limit.ts`.
9. **Run the tests** against a staging deployment (`npm test` plus the suites in `tests/README.md`).

## Vercel
`npm run vercel-build` (used automatically by Vercel) is `scripts/vercel-build.cjs`: it checks the environment and stops with a
readable message if something would make the deployment unusable, generates the Prisma client from
`prisma/postgres/schema.prisma`, applies the migrations, seeds (idempotent) and runs `next build`.

1. **Database:** create a PostgreSQL database (Neon, Supabase, …) with UTF8 encoding. SQLite cannot run on Vercel.
2. **Storage:** create an S3-compatible bucket (AWS S3 or Cloudflare R2) and set `STORAGE_DRIVER=s3` and the `S3_*` variables;
   local disk does not persist on Vercel.
3. **Environment variables** (Project → Settings → Environment Variables, for Production): `DATABASE_URL` (pooled URL),
   `DIRECT_URL` (non-pooled URL, used for migrations; with the Neon integration in Vercel this is provided as `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING` and is picked up automatically), `SESSION_SECRET`,
   (when adding the Neon integration leave its "custom prefix" empty so the variables are named `DATABASE_URL` and `DATABASE_URL_UNPOOLED`;
   at runtime the app adds `pgbouncer=true&connect_timeout=15` to a pooled Neon URL by itself, see `runtimeDatabaseUrl` in `src/lib/db.ts`), `APP_URL` (your `https://….vercel.app` or custom
   domain), `MAIL_PROVIDER` + `MAIL_FROM` + `SMTP_*` or `RESEND_API_KEY`, `STORAGE_DRIVER=s3` + `S3_*`, optionally `ANTHROPIC_API_KEY`.
   Never set `DISABLE_RATE_LIMIT`.
4. Push to GitHub, import the repository in Vercel (framework: Next.js; the build command is picked up from `vercel-build`).
5. After the first deploy: register, then make yourself admin from your own machine against the production database:
   `DATABASE_URL=<direct url> npm run make-admin -- you@example.com`.

Things to know:
- **Keep the functions next to the database.** `vercel.json` pins the serverless functions to `fra1` (Frankfurt), where the Neon
  database was created. One "next question" runs about ten sequential queries, so a function in another continent adds
  seconds per click. If the database is created in another region, change `regions` in `vercel.json` to the nearest Vercel
  region (Singapore `sin1`, London `lhr1`, US East `iad1`). Neon's free tier also suspends an idle database after 5 minutes;
  the first request afterwards waits 1-3 s.
- **Schema changes after the first deploy:** run `npm run db:gen-postgres` and commit `prisma/postgres`. It leaves every applied
  migration untouched and adds one new migration with only the difference, which the next deploy applies.
  (Never edit or regenerate `0001_init` once a production database exists.)
- **The rate limiter is in memory and per serverless instance**, so on Vercel the brute-force limits on login, registration and
  reset are much weaker than on a single server. Replace `src/lib/rate-limit.ts` with a shared store (Upstash Redis) before
  relying on them.
- AI explanations and PDFs are allowed up to 60 s (`maxDuration`); a plan with a shorter function limit may cut them off.
- The build was tested end to end (generate, migrate, seed, build, and a second idempotent run) against a real PostgreSQL.
  It has **not** been run on Vercel itself, so the first deployment is the first real test of the function bundle (for example
  the PDF fonts, which `next.config.ts` includes explicitly).

## Email
`src/lib/mail-transport.ts` sends through `MAIL_PROVIDER`:

| Provider | Needs | Notes |
|---|---|---|
| `smtp` | `SMTP_HOST`, `MAIL_FROM`; `SMTP_USER`/`SMTP_PASS` if the server authenticates | port 465 = implicit TLS, otherwise STARTTLS when offered (`SMTP_REQUIRE_TLS=true` makes it mandatory) |
| `resend` | `RESEND_API_KEY`, `MAIL_FROM` | HTTPS API; `MAIL_FROM` must be on a domain verified in Resend |
| `console` | nothing | prints the message to the server log; development only |

- Messages are bilingual (English/Mongolian), chosen by the language the visitor was using, then the saved account
  language. Every value placed in the HTML part is escaped.
- A mail failure never breaks sign-up or password reset (it is logged). **Resending** a verification email tells the
  user honestly when the send failed.
- Password-reset and sign-up emails are sent *after* the response, so response time cannot reveal whether an account exists.
- Tested against a real SMTP server (nodemailer to `smtp-server`: delivery, AUTH, refused recipients, outages, slow
  servers) and a mock Resend endpoint. **Not** tested against a live provider: deliverability (SPF/DKIM/DMARC, sender
  reputation) is yours to set up.

## File storage
`src/lib/storage.ts` has three functions (`putObject`, `getObject`, `deleteObject`); keys are validated before any driver
sees them and files are served through the app (`/api/assets`, `/api/avatar`), so a bucket can stay private.

`STORAGE_DRIVER=s3` variables: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, and for non-AWS
services `S3_ENDPOINT` (path-style addressing is then the default). `S3_PREFIX` shares one bucket between apps.
Deleting an account removes its avatar object (best effort: a storage failure is logged, not fatal).
Tested against a local S3-protocol server (`s3rver`, via the real app: uploads, replacement, deletion, serving, failures).
That server checks the access key but not the signature secret, so request signing relies on the AWS SDK itself;
it has **not** been run against AWS or R2.

## PostgreSQL
The SQLite schema is the source of truth; the PostgreSQL variant is generated from it so they cannot drift:
```bash
npm run db:gen-postgres        # writes prisma/postgres/{schema.prisma,migrations/0001_init}
```
Then either use the Docker setup below, or manually:
```bash
cp prisma/postgres/schema.prisma prisma/schema.prisma
rm -rf prisma/migrations && cp -r prisma/postgres/migrations prisma/migrations
DATABASE_URL=postgresql://… npx prisma migrate deploy
npx tsx prisma/seed.ts
npm run build && npm start
```
- **The database must be UTF8.** The seed stores Mongolian text; a database created with a legacy code page (for
  example `WIN1252`, the default on some Windows installs) rejects it ("character with byte sequence … has no
  equivalent in encoding"). The `postgres` Docker image uses UTF8.
- **Status: executed.** The full test-suite (HTTP suites 01-07 and 11-14, the production security suite 08 and the
  real-browser suites 09, 10 and 15) was run against a real PostgreSQL 18 server. That found and fixed two bugs
  that only PostgreSQL exposes: concurrent "next question" requests could each serve a different question
  (`advance` now takes the session's row lock first), and a NUL byte in a URL or body made PostgreSQL fail with a 500
  (NUL is now stripped from every query argument in `src/lib/db.ts`). `src/lib/db-compat.ts` supplies the
  case-insensitive search filter PostgreSQL needs.
- Not covered: load testing, long-running concurrency under production traffic, backup/restore drills.

## Docker
```bash
export POSTGRES_PASSWORD=… SESSION_SECRET=$(openssl rand -hex 32) APP_URL=https://your.domain
docker compose up --build
```
`docker-compose.yml` parses and passes the mail, storage and AI settings through. The `Dockerfile` and compose file
were **not built or run**: Docker is not installed in the development environment. Its steps are the ones executed by
hand above (generate the PostgreSQL schema, `prisma generate`, `npm run build`, `prisma migrate deploy`, seed, start),
but the image itself needs one build in CI before you rely on it.

## Operations
- **Maintenance mode / announcements / registration / leaderboard switches:** Admin → System.
- **Audit log:** Admin → Audit log (all admin actions, account deletions, role changes).
- **Logs:** unhandled server errors are written as one JSON line each (`src/instrumentation.ts`); no request bodies,
  cookies or personal data are logged.
- **Daily challenge:** five new questions are generated per UTC date on the first request (`src/lib/daily-gen.ts`),
  stored as inactive `origin = daily` questions (Admin → Questions, "daily"). If generation ever fails the app falls
  back to bank questions for that day.
- **Backups:** back up the database and the uploads volume or bucket. Account deletion removes personal data from the
  database (and the avatar object); backups follow your own retention policy.
- **Dependency advisories:** `npm audit` reports 3 high-severity findings, all in the Prisma CLI's configuration loader
  (`deepmerge-ts`). They affect the `prisma` command-line tool at development/deploy time, not the running server;
  the fix needs Prisma 7 (a breaking upgrade), which has not been done.
