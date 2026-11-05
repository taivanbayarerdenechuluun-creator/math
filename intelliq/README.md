# INTELLIQ

Adaptive cognitive-assessment platform: Next.js 16, React 19, TypeScript, Tailwind 4, Prisma 6, Framer Motion, Recharts.
It is a **practice and self-reflection tool, not a validated IQ test**. It never produces an invented IQ score or percentile.

## Quick start
```bash
npm install
cp .env.example .env                 # set SESSION_SECRET (>= 32 random chars)
npx prisma migrate dev               # creates prisma/dev.db (SQLite)
npm run seed                         # 960 questions (English + Mongolian), 7 categories, 11 assessments (safe to re-run)
npm run dev                          # http://localhost:3000
npm run make-admin -- you@example.com   # after registering, to open /admin
npm test                             # unit tests
```
Production uses PostgreSQL, SMTP/Resend email and optionally S3-compatible storage: see `docs/DEPLOYMENT.md` (including the Vercel steps).

## What is built
| Area | Highlights |
|---|---|
| Landing & design system | Dark/light themes (remembered), English/Mongolian, animated hero with page fade transitions, FAQ, SEO (`sitemap`, `robots`, Open Graph), custom 404/error pages |
| Assessments | 7 domains, **960 questions (120 hand-written + 840 generated, at least 135 per domain), every one with Mongolian text**; a person is not served a question they met in an earlier test while unseen ones remain; item types: text, figure sequences, memory with timed stimulus, **3D cube stacks** and **reaction-time pads**; 11 assessments, guest mode, autosave/resume, mark-for-review, keyboard control, optional timers |
| Adaptive engine | Per-domain 2-up/1-down staircase, balanced coverage, plus per-assessment **difficulty range, category shares and curated question pools** set in the admin panel (`docs/ADAPTIVE.md`) |
| Scoring | Server-side only; raw score, accuracy, difficulty-weighted performance; no IQ/percentile (`docs/SCORING.md`) |
| Results | Interactive radar, domain details, rule-based bilingual feedback, optional AI explanation (official Anthropic SDK), answer review with explanations |
| Gamification | XP, levels, 11 achievements with unlock animations, streaks, **a freshly generated daily challenge every day** (5 verified questions, logic / number series / pattern / memory / speed), weekly bonus |
| Progress | History, trend/time/domain charts, strengths and weaknesses, two-attempt comparison, CSV export |
| Reports | PDF report (English and Mongolian, vector radar), participation certificate, revocable share links |
| Social | Opt-in leaderboards (global/weekly/monthly/by domain, comparable versions only), opt-in public profile cards |
| Accounts | Register/login/logout, **real email delivery (SMTP or Resend) for verification and reset, in the visitor's language, with resend + in-app reminder**, profile + avatar, preferences, account deletion, notifications (English/Mongolian), global search (Ctrl+K), bookmarks |
| Storage | Local disk or any S3-compatible service (`STORAGE_DRIVER`), always served through the app |
| Admin | Analytics, question CRUD with preview/uploads/version history/restore and Mongolian fields, users and roles, assessment configuration, settings, maintenance mode, announcements, audit log (the admin panel is English only) |
| Security | See `docs/SECURITY.md` |

## Verification (what was actually run)
- **Unit tests** (`npm test`, 124 tests): question bank (answers recomputed independently, logic items proven by exhaustive model checking; the 840 generated questions are parsed back from their text and re-solved with separate code: series solvers, a small-model checker for syllogisms, truth tables, vocabulary lookups, matrix algebra, with mutation checks that the tests fail when a generator is broken), the daily-challenge generator (every generated question for four years of dates re-solved by independent solvers, plus mutation checks that the tests fail when the generator is broken), engine, scoring, feedback, gamification, history, leaderboard, schemas, image sniffing, AI request shape, **email against a real SMTP server and a mock Resend endpoint, S3 storage against a local S3 server**, and a guard that every user-facing API message has a Mongolian translation.
- **HTTP end-to-end suites 01-08, 11-14** (about 520 checks) and **real-browser suites 09, 10, 15** (about 260 checks, including axe WCAG 2 A/AA on the daily challenge, 3D and reaction questions in both languages): see `tests/README.md`.
- **Run on both databases.** Every suite (01-15) passed on SQLite and on a real PostgreSQL 18 server. Running on PostgreSQL found two bugs SQLite hides (parallel "next question" requests could serve different questions; a NUL byte in a URL caused a 500); both are fixed and covered by tests.
- Browser checks of the Mongolian interface: no English text left in visible text, labels or tab titles on 21 pages; no horizontal overflow at 390/768/1280 px (Mongolian) and 768/1024 px (English); an internal-link crawl (130 URLs as a guest, 130 as a signed-in user) found no broken link; every safe button on 10 pages was pressed without a script error. The screenshots were also looked at by eye.
- `npm run build`, `tsc --noEmit` and ESLint (0 errors; 6 warnings: intentional full-page reloads after sign-in/out and one admin preview `<img>`) are clean.

## Known limitations (please read)
- **The Mongolian text was written without a native-speaker review** (this includes the 840 generated questions, whose Mongolian is composed from templates and a small vocabulary table in `src/data/bank/gen/lexicon.ts`). It is complete and consistent (and automatically checked for missing translations and layout), but wording, tone and terminology should be reviewed by a native speaker before launch. The admin panel itself is English only.
- **No live-provider tests.** Email is tested against a local SMTP server and a mock Resend API (not a real provider: deliverability, SPF/DKIM are yours to set up); S3 storage against a local S3-protocol server that does not verify signature secrets (not AWS/R2); the AI explanation against a mock provider (no API key was available).
- **Docker was not built or run** (Docker is not installed in the development environment). The `Dockerfile`/`docker-compose.yml` follow the steps that were executed by hand against PostgreSQL, and the compose file parses, but the image needs one build in CI.
- **PostgreSQL must be a UTF8 database.** A database in a legacy code page rejects Mongolian text.
- **No norm sample exists**, so no IQ, percentile or "normal range" is shown, by design.
- The in-memory rate limiter is per instance. Not independently penetration-tested; no load testing.
- **Browser coverage is Microsoft Edge (headless) at emulated widths.** Real phones/tablets, other browsers and manual screen-reader testing were not done. Daily-challenge questions are generated from a fixed family of templates (about 290-360 distinct questions per slot per year, some repeat after that).
- `npm audit` reports 3 high findings in the Prisma CLI's config loader (development/deploy tooling, not the running server); fixing them needs the breaking Prisma 7 upgrade.

## Docs
[Adaptive algorithm](docs/ADAPTIVE.md) · [Scoring](docs/SCORING.md) · [Feedback & AI](docs/FEEDBACK.md) · [Security](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md) · [Tests](tests/README.md)
