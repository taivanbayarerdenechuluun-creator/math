# Security model

Every control below is covered by an automated test (see "Verification" in the README).

| Area | Control |
|---|---|
| Authentication | bcrypt (cost 12); signed HS256 JWT in an `HttpOnly; SameSite=Lax; Secure` cookie; generic login errors with a constant-time dummy compare; reset tokens stored hashed (SHA-256), single-use, 1 h expiry; email verification tokens single-use |
| Authorization | Server-side RBAC. `/admin` is a 404 for non-admins and every `/api/admin/*` call re-checks the ADMIN role. Sessions, results, reports, PDFs, certificates, notifications and avatars are owner-scoped; other users get 404, not 403 |
| Suspended accounts | Lose access immediately (checked on every request, not only at login) |
| Answer integrity | Answer keys and explanations never leave the server during a test; scores are computed server-side from stored selections; client-sent scores are ignored; timed answers are final and late answers are discarded; memory material is served once inside its window |
| CSRF | SameSite=Lax cookies plus an `Origin` check on every authenticated mutation |
| Input | zod validation on every API body; strict figure schemas (no unknown keys, bounded sizes); no raw HTML is ever rendered from stored content |
| Uploads | Images only, verified by magic bytes (SVG/HTML rejected), size-capped, random names, served with `nosniff` and a sandboxing CSP; path traversal impossible (strict name regex + key allow-list) |
| Rate limiting | Login (per account+IP), registration, password reset, sessions, search, PDF, AI, account deletion, admin API |
| Headers | CSP (no `unsafe-eval`, no wildcards, `frame-ancestors 'none'`), HSTS, `X-Frame-Options`, `nosniff`, Referrer-Policy, Permissions-Policy; `X-Powered-By` removed |
| Privacy | Leaderboards and public profiles are opt-in; only first name, level and badges are public; share links expose scores only and are revocable; account deletion removes sessions, results, reports, XP, badges and photo |
| Auditability | Admin actions and account deletions are written to an audit log; unhandled errors are logged as structured JSON |
| Email | Sign-up and reset emails are sent after the response (timing cannot reveal whether an account exists); recipients are validated as a single plain address (no header injection); everything placed in the HTML part is escaped; resending verification is rate-limited per user and per IP and rotates the token (the old link stops working) |
| Database input | NUL bytes are stripped from every query argument (PostgreSQL rejects them with an error, which would otherwise be a 500 on odd URLs) |
| Concurrency | `next` requests for one session are serialised by the session row lock; answers claim their first resolution atomically; awards and results are unique per user/reason/reference; verified with parallel requests on SQLite and PostgreSQL |
| Data integrity | Transactions around finalisation, awards and question edits; questions with recorded answers cannot have their answer key changed (they are retired instead) |

## Known limitations
- The in-memory rate limiter is per instance (see DEPLOYMENT.md).
- Email delivery is implemented (SMTP, Resend) and tested against a local SMTP server, but not against a live provider; SPF/DKIM/DMARC are the operator's job.
- S3 storage is tested against a local S3-protocol server only (see DEPLOYMENT.md).
- Not independently penetration-tested; automated checks only.
