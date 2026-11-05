# End-to-end test suites

Unit tests live next to the code (`npm test`, 120+ tests). These suites exercise a **running** server and the real
database, using plain Node scripts. They create their own users/sessions and clean up after themselves, but they
operate on the configured database: **point `DATABASE_URL` at a scratch database, never at production data.**

| Suite | What it covers | Server mode |
|---|---|---|
| 01 assessments API | session lifecycle, adaptive routing, scoring, access control, timers, memory stimulus | dev |
| 02 pages & access | public pages, results/test access control, locked timed answers | dev |
| 03 feedback & AI | previous-attempt comparison, AI endpoint (with/without a key; mock provider) | dev (`noai`; or `ai <calls.json>` with the app started with `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` pointing at `mock-ai-server.cjs`, see below) |
| 04 gamification & daily | XP, streaks, achievements, idempotency, daily challenge, weekly bonus, CSRF | dev |
| 05 history, reports, leaderboard | history, PDF (EN/MN), share/revoke, certificate, CSV, leaderboard privacy and ranking | dev |
| 06 admin & security | RBAC, question CRUD/versions/integrity rules, uploads, users, assessments, settings, maintenance, roles, audit | dev |
| 07 account, search, SEO | settings, avatar privacy, notifications, search, bookmarks, account deletion, robots/sitemap | dev |
| 08 production security | headers/CSP/HSTS, cookie flags, token forgery, enumeration, XSS, odd ids, brute-force limits | **production** |
| 09 browser: assessment flow | full 28-question run by keyboard, resume, themes, language, overflow | production |
| 10 browser: app + accessibility | dashboard, search, notifications, daily, history, settings, admin UI, maintenance, 390px overflow, axe WCAG 2 A/AA | **production** |
| 11 i18n, reaction, config, concurrency | Mongolian payloads, reaction items (every timing case), difficulty range / category shares / curated pools, admin validation, parallel next/answer/submit, seed safety, **no question repeats across a person's tests (signed-in and guest)** | dev |
| 12 generated daily challenge | creation under a race, storage, what the API exposes, the stored questions equal the generator's, scoring, recovery, admin view, bank fallback | dev |
| 13 email flows | sign-up, verification, resend, password reset, language choice, no account enumeration by timing, outages; hosts its own SMTP server | dev, app started with SMTP settings (below) |
| 14 S3 storage | avatars and admin images land in the bucket (not on disk), served through the app, replaced/deleted correctly, validated first | dev, app started with S3 settings (below) |
| 15 browser: Mongolian, tablets, crawl, smoke, axe | no English left in the Mongolian UI (text, labels, titles), no overflow at 390/768/1280 (Mongolian) and 768/1024 (English), internal-link crawl as guest and user, every safe button pressed, axe on daily/3D/reaction/results in both languages | **production** |

## Running
```bash
# Dev suites (01-07, 11-14): the limiter bypass is ignored in production builds
DISABLE_RATE_LIMIT=1 npm run dev -- -p 3100
node tests/01-assessments-api.cjs          # ...and so on; 03 takes the argument `noai`

# Production suites (08-10, 15): real headers, CSP and rate limits. Restart the server between runs of 08
# (the limiter is in memory).
npm run build && MAIL_PROVIDER=console npm start -- -p 3100
node tests/15-browser-mongolian-tablet-crawl.cjs
node tests/10-browser-app-and-accessibility.cjs
node tests/08-production-security.cjs      # restart the server first, and run it last
```
Env: `B` (base URL, default `http://localhost:3100`), `BROWSER_PATH` (Edge/Chrome executable for 09, 10, 15).
Screenshots are written to `tests/out/`.

### Email (suite 13)
The suite starts an SMTP server on 127.0.0.1:2526 itself. Start the app with
`MAIL_PROVIDER=smtp SMTP_HOST=127.0.0.1 SMTP_PORT=2526 MAIL_FROM="INTELLIQ <no-reply@intelliq.test>" APP_URL=http://localhost:3100`.

### S3 storage (suite 14)
```bash
node tests/s3-server.cjs        # local S3-protocol server on 127.0.0.1:4570, bucket intelliq-app (leave running)
STORAGE_DRIVER=s3 S3_ENDPOINT=http://127.0.0.1:4570 S3_BUCKET=intelliq-app S3_ACCESS_KEY_ID=S3RVER S3_SECRET_ACCESS_KEY=S3RVER npm run dev -- -p 3100
node tests/14-s3-storage.cjs
```
Suites 06 and 07 (uploads, avatars) also pass in this mode.

### PostgreSQL
No Docker is needed: `tests/pg-server.mjs` starts a real PostgreSQL (the `embedded-postgres` package) on port 5433 with a
UTF8 database.
```bash
node tests/pg-server.mjs                    # leave running
npm run db:gen-postgres
export DATABASE_URL=postgresql://postgres:postgres@localhost:5433/intelliq
npx prisma migrate deploy --schema prisma/postgres/schema.prisma
npx prisma generate --schema prisma/postgres/schema.prisma
npx tsx prisma/seed.ts
npm run dev -- -p 3100                      # then any suite, with the same DATABASE_URL exported for the scripts
# afterwards, switch the client back to SQLite:  unset DATABASE_URL; npx prisma generate
```
Stop the server with `pg_ctl stop -D <the temp data dir> -m fast` (the exact data directory only), not by killing every
`postgres` process: you may have your own.

### AI explanation (suite 03, `ai` mode)
```bash
node tests/mock-ai-server.cjs tests/out/mock-ai-calls.json 4010     # a stand-in for the Anthropic API (leave running)
ANTHROPIC_API_KEY=test-key ANTHROPIC_BASE_URL=http://127.0.0.1:4010 DISABLE_RATE_LIMIT=1 npm run dev -- -p 3100
node tests/03-feedback-and-ai.cjs ai tests/out/mock-ai-calls.json
```

### Other files
`daily-print.ts` and `daily-fallback.ts` (helpers for suite 12, run with `tsx`), `lib.cjs` (shared helpers).
Unit tests worth knowing: `src/lib/daily-gen.test.ts` re-solves every generated daily question for four years of dates
with solvers that share no code with the generator; `mail.test.ts` talks to a real SMTP server;
`storage-s3.test.ts` to a local S3 server; `server-errors.test.ts` fails when a user-facing API message lacks a Mongolian translation.

> Suite 08 deliberately exhausts the in-memory rate limits (login, registration, reset, search). Run it **last**, or
> restart the server afterwards, before running other suites against the same production process.
