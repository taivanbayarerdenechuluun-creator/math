const L = require("./lib.cjs");
const { db, B, ok, client, post, play, register, done } = L;
const patch = (c, path, body, headers) => c(path, { method: "PATCH", body: JSON.stringify(body), headers });
const del = (c, path, body, headers) => c(path, { method: "DELETE", body: body ? JSON.stringify(body) : undefined, headers });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

async function uploadAvatar(c, buf, name, type, headers = {}) {
  const form = new FormData();
  form.append("file", new Blob([buf], { type }), name);
  const cookie = (await c("/api/auth/me")).cookie();
  const r = await fetch(`${B}/api/account/avatar`, { method: "POST", body: form, headers: { cookie, ...headers } });
  return { status: r.status, json: await r.json().catch(() => null) };
}

(async () => {
  const u = client(), other = client(), anon = client();
  const email = await register(u, "Setting Tester");
  const otherEmail = await register(other, "Other Tester");
  const me = await db.user.findUnique({ where: { email } });

  console.log("settings & profile");
  let r = await u("/settings"); ok(r.status === 200 && /Delete account/.test(r.text) && /Appear on leaderboards/.test(r.text), "settings page renders");
  r = await anon("/settings"); ok(r.status === 307, "settings requires sign-in");
  r = await patch(anon, "/api/account", { name: "Hacker" }); ok(r.status === 401, "PATCH requires sign-in");
  r = await patch(u, "/api/account", { name: "Evil" }, { Origin: "https://evil.example" }); ok(r.status === 403, "PATCH blocks cross-site requests");
  r = await patch(u, "/api/account", { name: "x" }); ok(r.status === 400, "name too short rejected");
  r = await patch(u, "/api/account", {}); ok(r.status === 400, "empty update rejected");
  r = await patch(u, "/api/account", { theme: "pink" }); ok(r.status === 400, "invalid theme rejected");
  r = await patch(u, "/api/account", { name: "Renamed Person", theme: "light", language: "mn", showOnLeaderboard: true, publicProfile: true }); ok(r.status === 200, "profile + preferences + privacy saved");
  const row = await db.user.findUnique({ where: { id: me.id }, include: { preferences: true } });
  ok(row.name === "Renamed Person" && row.showOnLeaderboard && row.publicProfile && row.preferences.theme === "light" && row.preferences.language === "mn", "values persisted");
  r = await patch(u, "/api/account", { role: "ADMIN", xp: 99999, passwordHash: "x", name: "Still Me" });
  const after = await db.user.findUnique({ where: { id: me.id }, include: { role: true } });
  ok(after.role.name === "USER" && after.xp === 0 && after.passwordHash !== "x", "mass-assignment of role/xp/passwordHash is ignored");
  r = await anon("/api/status"); ok(r.json.user === null, "status: anonymous");
  r = await u("/api/status"); ok(r.json.user.name === "Still Me" && r.json.user.prefs.language === "mn", "status exposes the user's saved preferences");

  console.log("avatar upload & visibility");
  r = await uploadAvatar(u, PNG, "me.png", "image/png"); ok(r.status === 200, "valid PNG accepted");
  const own = await fetch(`${B}/api/avatar/${me.id}`, { headers: { cookie: (await u("/api/auth/me")).cookie() } });
  ok(own.status === 200 && own.headers.get("content-type") === "image/png" && own.headers.get("x-content-type-options") === "nosniff", "owner can fetch it with safe headers");
  await db.user.update({ where: { id: me.id }, data: { publicProfile: false } });
  ok((await anon(`/api/avatar/${me.id}`)).status === 404, "private profile: avatar hidden from others");
  await db.user.update({ where: { id: me.id }, data: { publicProfile: true } });
  ok((await fetch(`${B}/api/avatar/${me.id}`)).status === 200, "public profile: avatar visible");
  r = await uploadAvatar(u, Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), "a.svg", "image/svg+xml"); ok(r.status === 415, "SVG avatar rejected");
  r = await uploadAvatar(u, Buffer.from("<html>x</html>"), "a.png", "image/png"); ok(r.status === 415, "HTML disguised as PNG rejected");
  r = await uploadAvatar(u, Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(2 * 1024 * 1024)]), "big.png", "image/png"); ok(r.status === 413, "oversized avatar rejected");
  r = await uploadAvatar(u, PNG, "me.png", "image/png", { Origin: "https://evil.example" }); ok(r.status === 403, "cross-site upload blocked");
  r = await uploadAvatar(anon, PNG, "me.png", "image/png"); ok(r.status === 401, "anonymous upload blocked");
  ok((await fetch(`${B}/api/avatar/..%2F..%2Fx`)).status === 404, "avatar id is validated");
  r = await del(u, "/api/account/avatar"); ok(r.status === 200, "avatar removed");
  ok((await fetch(`${B}/api/avatar/${me.id}`)).status === 404, "removed avatar is gone");

  console.log("notifications");
  const rid = await play(u, "quick-check", 10);
  r = await u("/api/notifications"); ok(r.status === 200 && r.json.items.length >= 2 && r.json.items.some((n) => /Assessment complete/.test(n.title)), `notifications created (${r.json.items.length})`);
  r = await u("/api/status"); ok(r.json.unread >= 2, `unread count in status (${r.json.unread})`);
  const theirs = (await u("/api/notifications")).json.items[0];
  r = await post(other, "/api/notifications", { id: theirs.id }); ok(r.json.updated === 0, "another user cannot mark my notification read");
  r = await post(anon, "/api/notifications", { markAll: true }); ok(r.status === 401, "anonymous cannot mark notifications");
  r = await post(u, "/api/notifications", { markAll: true }, { Origin: "https://evil.example" }); ok(r.status === 403, "cross-site mark-read blocked");
  r = await post(u, "/api/notifications", { markAll: true }); ok(r.json.updated >= 2, "mark all read");
  r = await u("/api/status"); ok(r.json.unread === 0, "unread is zero afterwards");
  ok((await anon("/api/notifications")).status === 401, "listing requires sign-in");
  ok((await other("/api/notifications")).json.items.every((n) => n.id !== theirs.id), "notifications are private to their owner");

  console.log("search");
  r = await anon("/api/search?q=q"); ok(r.json.hits.length === 0, "queries under 2 characters return nothing");
  r = await anon("/api/search?q=quick"); ok(r.json.hits.some((h) => h.type === "assessment" && h.href === "/assessments/quick-check"), "finds assessments");
  r = await anon("/api/search?q=settings"); ok(r.json.hits.some((h) => h.href === "/settings"), "finds pages");
  r = await anon("/api/search?q=streak"); ok(r.json.hits.some((h) => h.type === "achievement"), "finds achievements");
  r = await anon("/api/search?q=quick"); ok(!r.json.hits.some((h) => h.type === "result"), "anonymous search never returns results");
  r = await u("/api/search?q=quick"); ok(r.json.hits.some((h) => h.type === "result" && h.href === `/results/${rid}`), "signed-in search finds the user's own results");
  r = await other("/api/search?q=quick"); ok(!r.json.hits.some((h) => h.type === "result"), "other users' results are not searchable");
  r = await anon(`/api/search?q=${encodeURIComponent("' OR 1=1 --")}`); ok(r.status === 200 && Array.isArray(r.json.hits), "injection-style input is handled safely");
  r = await anon(`/api/search?q=${"a".repeat(500)}`); ok(r.status === 200, "overlong query is truncated, not an error");

  console.log("bookmarks");
  r = await post(anon, "/api/bookmarks", { slug: "quick-check" }); ok(r.status === 401, "bookmark requires sign-in");
  r = await post(u, "/api/bookmarks", { slug: "nope" }); ok(r.status === 404, "unknown assessment 404");
  r = await post(u, "/api/bookmarks", { slug: "quick-check" }); ok(r.json.bookmarked === true, "bookmark added");
  r = await u("/dashboard"); ok(/Quick Check/.test(r.text) && /Bookmarked assessments/.test(r.text), "dashboard lists bookmarks");
  r = await u("/assessments/quick-check"); ok(/Bookmarked/.test(r.text), "overview reflects bookmark state");
  r = await post(u, "/api/bookmarks", { slug: "quick-check" }); ok(r.json.bookmarked === false, "toggled off");

  console.log("SEO & error pages");
  r = await anon("/robots.txt"); ok(r.status === 200 && /Disallow: \/admin/.test(r.text) && /Sitemap:/.test(r.text), "robots.txt blocks private areas and links the sitemap");
  r = await anon("/sitemap.xml"); ok(r.status === 200 && /<loc>[^<]*\/assessments\/quick-check<\/loc>/.test(r.text), "sitemap.xml lists assessments");
  r = await anon("/"); ok(/<title>INTELLIQ/.test(r.text) && /name="description"/.test(r.text) && /property="og:title"/.test(r.text), "landing has title, description and Open Graph tags");
  ok(/rel="canonical"|name="viewport"/.test(r.text), "viewport meta present");
  r = await anon("/nope-nope"); ok(r.status === 404 && /404/.test(r.text), "custom 404 page");
  r = await anon("/assessments/nope"); ok(r.status === 404, "unknown assessment 404");

  console.log("account deletion");
  const sess = await db.assessmentSession.count({ where: { userId: me.id } });
  const shareRes = await post(u, `/api/results/${rid}/share`, { enable: true });
  const token = shareRes.json.shareToken;
  ok(sess >= 1 && (await anon(`/r/${token}`)).status === 200, "precondition: user has sessions and a live share link");
  r = await del(u, "/api/account", { password: "WrongPassword1" }); ok(r.status === 403, "wrong password refused");
  r = await del(u, "/api/account", {}, { Origin: "https://evil.example" }); ok(r.status === 403, "cross-site deletion blocked");
  r = await del(anon, "/api/account", { password: "x" }); ok(r.status === 401, "anonymous deletion blocked");
  r = await del(u, "/api/account", { password: "Str0ngPassw0rd" }); ok(r.status === 200, "correct password deletes the account");
  ok(!(await db.user.findUnique({ where: { id: me.id } })), "user row is gone");
  const left = await Promise.all([db.assessmentSession.count({ where: { userId: me.id } }), db.assessmentResult.count({ where: { userId: me.id } }), db.xPTransaction.count({ where: { userId: me.id } }), db.userAchievement.count({ where: { userId: me.id } }), db.notification.count({ where: { userId: me.id } }), db.userPreference.count({ where: { userId: me.id } }), db.report.count({ where: { resultId: rid } }), db.assessmentResult.count({ where: { id: rid } })]);
  ok(left.every((n) => n === 0), `all personal data deleted (${left.join(",")})`);
  ok((await anon(`/r/${token}`)).status === 404, "their share link stops working");
  r = await u("/api/auth/me"); ok(r.json.user === null, "session no longer valid");
  r = await post(client(), "/api/auth/login", { email, password: "Str0ngPassw0rd" }); ok(r.status === 401, "cannot log in again");
  ok((await db.auditLog.count({ where: { action: "account.delete", target: me.id } })) === 1, "deletion is recorded in the audit log (id only)");

  // the only admin cannot delete themselves
  const adm = client(); const admEmail = await register(adm, "Solo Admin");
  const role = await db.role.upsert({ where: { name: "ADMIN" }, update: {}, create: { name: "ADMIN" } });
  await db.user.updateMany({ where: { role: { name: "ADMIN" } }, data: { roleId: (await db.role.upsert({ where: { name: "USER" }, update: {}, create: { name: "USER" } })).id } });
  await db.user.update({ where: { email: admEmail }, data: { roleId: role.id } });
  r = await del(adm, "/api/account", { password: "Str0ngPassw0rd" }); ok(r.status === 409, "the only administrator cannot delete their account");

  await db.assessmentSession.deleteMany({});
  await db.user.deleteMany({ where: { email: { in: [otherEmail, admEmail] } } });
  await done();
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(2); });
