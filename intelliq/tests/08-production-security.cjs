// Security suite: run against a PRODUCTION server (real headers, CSP and rate limits).
const L = require("./lib.cjs");
const { db, B, ok, client, post, done } = L;
const { SignJWT } = require("jose");
const secret = new TextEncoder().encode(/SESSION_SECRET="([^"]+)"/.exec(require("fs").readFileSync(require("path").join(__dirname, "..", ".env"), "utf8"))[1]);

(async () => {
  const anon = client();
  console.log("security headers");
  let r = await anon("/");
  const h = r.headers;
  ok(h.get("x-frame-options") === "DENY", "X-Frame-Options: DENY");
  ok(h.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
  ok(/strict-origin/.test(h.get("referrer-policy") ?? ""), "Referrer-Policy");
  ok(/camera=\(\)/.test(h.get("permissions-policy") ?? ""), "Permissions-Policy denies camera/mic/geolocation");
  ok(/max-age=\d{7,}/.test(h.get("strict-transport-security") ?? ""), "HSTS in production");
  const csp = h.get("content-security-policy") ?? "";
  ok(/default-src 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /base-uri 'self'/.test(csp) && /form-action 'self'/.test(csp), "CSP restricts sources, framing, base and forms");
  ok(!/unsafe-eval/.test(csp) && !/script-src[^;]*\*/.test(csp), "CSP has no unsafe-eval and no wildcard scripts");
  ok(!h.get("x-powered-by"), "X-Powered-By hidden");
  r = await anon("/api/status"); ok(/no-store/.test(r.headers.get("cache-control") ?? ""), "dynamic API responses are not cached");

  console.log("password storage & enumeration");
  const email = `sec${Date.now()}@example.com`;
  const u = client();
  r = await post(u, "/api/auth/register", { name: "Sec Tester", email, password: "Str0ngPassw0rd" }); ok(r.status === 200, "register");
  const setCookie = (await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Str0ngPassw0rd" }) })).headers.getSetCookie().join(" | ");
  ok(/iq_session=/.test(setCookie) && /HttpOnly/i.test(setCookie) && /SameSite=lax/i.test(setCookie) && /Secure/i.test(setCookie) && /Max-Age=\d+/i.test(setCookie), "session cookie: HttpOnly; SameSite=Lax; Secure; Max-Age");
  const row = await db.user.findUnique({ where: { email } });
  ok(/^\$2[aby]\$12\$/.test(row.passwordHash) && !row.passwordHash.includes("Str0ng"), "password stored as bcrypt (cost 12), never plaintext");
  const a = await post(client(), "/api/auth/login", { email, password: "wrong-password" });
  const b = await post(client(), "/api/auth/login", { email: "nobody-here@example.com", password: "wrong-password" });
  ok(a.status === 401 && b.status === 401 && a.json.error === b.json.error, "wrong password and unknown email give identical responses");
  const f1 = await post(client(), "/api/auth/forgot", { email }), f2 = await post(client(), "/api/auth/forgot", { email: "ghost@example.com" });
  ok(f1.status === 200 && f2.status === 200 && JSON.stringify(f1.json) === JSON.stringify(f2.json), "password-reset responses do not reveal whether an account exists");
  r = await post(client(), "/api/auth/register", { name: "Sec Tester", email, password: "Str0ngPassw0rd" }); ok(r.status === 409, "duplicate registration refused");
  r = await post(client(), "/api/auth/register", { name: "Weak", email: "weak@example.com", password: "password" }); ok(r.status === 400, "weak password refused");

  console.log("session token tampering");
  const me = async (cookie) => (await (await fetch(`${B}/api/auth/me`, { headers: { cookie } })).json()).user;
  const good = (await u("/api/auth/me")).cookie();
  ok((await me(good))?.email === email, "valid cookie works");
  const token = /iq_session=([^;]+)/.exec(good)[1];
  const [hd, pl, sg] = token.split(".");
  ok((await me(`iq_session=${hd}.${pl}.${sg.slice(0, -2)}xx`)) === null, "tampered signature rejected");
  const forgedPayload = Buffer.from(JSON.stringify({ sub: row.id, exp: 9999999999 })).toString("base64url");
  ok((await me(`iq_session=${hd}.${forgedPayload}.${sg}`)) === null, "modified payload with old signature rejected");
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")}.${pl}.`;
  ok((await me(`iq_session=${none}`)) === null, "alg=none token rejected");
  const expired = await new SignJWT({ sub: row.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(Math.floor(Date.now() / 1000) - 7200).setExpirationTime(Math.floor(Date.now() / 1000) - 3600).sign(secret);
  ok((await me(`iq_session=${expired}`)) === null, "expired token rejected");
  const ghost = await new SignJWT({ sub: "cldoesnotexist000000000000" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(secret);
  ok((await me(`iq_session=${ghost}`)) === null, "valid signature for a nonexistent user rejected");
  const wrongKey = await new SignJWT({ sub: row.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode("x".repeat(40)));
  ok((await me(`iq_session=${wrongKey}`)) === null, "token signed with a different key rejected");

  console.log("injection & XSS");
  r = await post(client(), "/api/auth/login", { email: "' OR 1=1 --", password: "x" }); ok(r.status === 400 || r.status === 401, "SQL-injection style login input rejected");
  r = await post(client(), "/api/auth/login", { email: { $ne: null }, password: { $ne: null } }); ok(r.status === 400 || r.status === 401, "operator-object login input rejected");
  const xss = client(); const xssEmail = `xss${Date.now()}@example.com`;
  r = await post(xss, "/api/auth/login", { email, password: "Str0ngPassw0rd" });
  await db.user.update({ where: { email }, data: { name: "<img src=x onerror=alert(1)> Evil", showOnLeaderboard: true, publicProfile: true } });
  r = await u("/dashboard"); ok(r.status === 200 && !/<img src=x onerror/.test(r.text) && /&lt;img/.test(r.text), "hostile display name is escaped on the dashboard");
  r = await anon(`/u/${row.id}`); ok(r.status === 200 && !/<img src=x onerror/.test(r.text), "hostile display name is escaped on the public profile");
  void xssEmail;
  r = await anon("/definitely/not/here?<script>alert(1)</script>"); ok(r.status === 404 && !/<script>alert\(1\)<\/script>/.test(r.text), "reflected input in 404 is not rendered as markup");

  console.log("robustness");
  r = await anon("/api/sessions"); ok(r.status === 405, "GET on a POST-only route is 405");
  const big = await fetch(`${B}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "a@b.co", password: "x".repeat(2_000_000) }) });
  ok(big.status < 500, `oversized JSON body does not crash the server (${big.status})`);
  r = await fetch(`${B}/api/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" }); ok(r.status === 400, "malformed JSON gives 400, not 500");
  r = await anon("/api/results/not-a-real-id/pdf"); ok(r.status === 404, "unknown result id -> 404");
  r = await anon("/api/sessions/%00%2e%2e"); ok(r.status === 404, "odd session id -> 404");

  console.log("rate limiting (real limiter)");
  const rl = async (path, body, n) => { const codes = []; for (let i = 0; i < n; i++) codes.push((await post(client(), path, typeof body === "function" ? body(i) : body)).status); return codes; };
  let codes = await rl("/api/auth/login", { email: "victim@example.com", password: "wrong" }, 10);
  ok(codes.slice(0, 8).every((c) => c === 401) && codes[8] === 429 && codes[9] === 429, `login brute force: 8 tries then 429 (${codes.join(" ")})`);
  r = await post(client(), "/api/auth/login", { email: "other-victim@example.com", password: "wrong" }); ok(r.status === 401, "limit is per account+IP: a different account is not blocked");
  codes = await rl("/api/auth/forgot", (i) => ({ email: `f${i}@example.com` }), 7);
  ok(codes.slice(0, 3).every((c) => c === 200) && codes.slice(3).every((c) => c === 429), `password reset: limit of 5 per window (2 already used above) then 429 (${codes.join(" ")})`);
  codes = await rl("/api/auth/register", (i) => ({ name: "Flood", email: `flood${Date.now()}${i}@example.com`, password: "Str0ngPassw0rd" }), 7);
  const created = codes.filter((c) => c === 200).length;
  ok(codes[codes.length - 1] === 429 && created <= 5, `registration flood: at most 5 accounts then 429 (${codes.join(" ")})`);
  await db.user.deleteMany({ where: { email: { startsWith: "flood" } } });
  codes = []; for (let i = 0; i < 65; i++) codes.push((await anon("/api/search?q=quick")).status);
  ok(codes.slice(0, 60).every((c) => c === 200) && codes.slice(60).every((c) => c === 429), "search: 60/min then 429");

  await db.user.deleteMany({ where: { email } });
  await db.user.deleteMany({ where: { email: { startsWith: "weak" } } });
  await done();
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(2); });
