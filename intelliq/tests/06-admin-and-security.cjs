const L = require("./lib.cjs");
const { db, B, ok, client, post, play, register, done } = L;

const put = (c, path, body, headers) => c(path, { method: "PUT", body: JSON.stringify(body), headers });
const del = (c, path, headers) => c(path, { method: "DELETE", headers });
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

async function upload(c, buf, name, type) {
  const form = new FormData();
  form.append("file", new Blob([buf], { type }), name);
  const cookie = (await c("/api/auth/me")).cookie();
  const r = await fetch(`${B}/api/admin/upload`, { method: "POST", body: form, headers: { cookie } });
  return { status: r.status, json: await r.json().catch(() => null) };
}

const goodQ = (over = {}) => ({
  categorySlug: "logical", prompt: "Admin test: which letter comes after A?", difficulty: 2, explanation: "B follows A in the alphabet.",
  options: [{ label: "B", isCorrect: true }, { label: "C", isCorrect: false }, { label: "D", isCorrect: false }, { label: "Z", isCorrect: false }], ...over,
});

(async () => {
  const admin = client(), user = client(), anon = client();
  const adminEmail = await register(admin, "Admin Person");
  const userEmail = await register(user, "Regular Person");
  await db.user.update({ where: { email: adminEmail }, data: { role: { connect: { name: "ADMIN" } } } }).catch(async () => {
    const role = await db.role.upsert({ where: { name: "ADMIN" }, update: {}, create: { name: "ADMIN" } });
    await db.user.update({ where: { email: adminEmail }, data: { roleId: role.id } });
  });
  const adminRow = await db.user.findUnique({ where: { email: adminEmail } });
  const userRow = await db.user.findUnique({ where: { email: userEmail } });

  console.log("access control (server-side RBAC)");
  let r = await anon("/admin"); ok(r.status === 307 && /\/login/.test(r.location ?? ""), "anonymous -> redirected to /login");
  r = await user("/admin"); ok(r.status === 404, "signed-in non-admin gets 404");
  const seed = await db.question.findFirst();
  const pages = ["/admin", "/admin/questions", "/admin/questions/new", `/admin/questions/${seed.id}`, "/admin/users", `/admin/users/${userRow.id}`, "/admin/assessments", "/admin/system", "/admin/audit"];
  for (const p of pages) {
    const a = await admin(p), u = await user(p), n = await anon(p);
    ok(a.status === 200 && u.status === 404 && n.status === 307, `${p}: admin 200 / user 404 / anon 307`);
  }
  r = await post(anon, "/api/admin/questions", goodQ()); ok(r.status === 403, "API: anonymous 403");
  r = await post(user, "/api/admin/questions", goodQ()); ok(r.status === 403, "API: non-admin 403");
  r = await post(admin, "/api/admin/questions", goodQ(), { Origin: "https://evil.example" }); ok(r.status === 403, "API: cross-site admin request blocked (CSRF)");
  r = await post(admin, "/api/admin/nonsense", {}); ok(r.status === 404, "API: unknown admin route 404");
  r = await put(user, `/api/admin/users/${userRow.id}`, { roleName: "ADMIN" }); ok(r.status === 403, "privilege escalation: user cannot promote themselves");
  ok((await db.user.findUnique({ where: { id: userRow.id }, include: { role: true } })).role.name === "USER", "role unchanged after escalation attempt");

  console.log("question management");
  r = await post(admin, "/api/admin/questions", goodQ({ options: goodQ().options.map((o) => ({ ...o, isCorrect: true })) })); ok(r.status === 400 && /Exactly one/.test(r.json.error), "rejects two correct answers");
  r = await post(admin, "/api/admin/questions", goodQ({ options: [{ label: "B", isCorrect: true }] })); ok(r.status === 400, "rejects a single option");
  r = await post(admin, "/api/admin/questions", goodQ({ figure: { k: "glyph", shape: "<script>" } })); ok(r.status === 400, "rejects an invalid figure");
  r = await post(admin, "/api/admin/questions", goodQ({ categorySlug: "nope" })); ok(r.status === 400, "rejects unknown category");
  r = await post(admin, "/api/admin/questions", goodQ({ imageUrl: "https://evil.example/x.png" })); ok(r.status === 400, "rejects external image URLs");
  r = await post(admin, "/api/admin/questions", goodQ()); ok(r.status === 201 && r.json.id, "creates a valid question");
  const qid = r.json.id;
  let dbq = await db.question.findUnique({ where: { id: qid }, include: { options: true } });
  ok(dbq.version === 1 && dbq.options.length === 4 && dbq.options.filter((o) => o.isCorrect).length === 1, "stored with 4 options, one correct");
  r = await admin(`/admin/questions/${qid}`); ok(r.status === 200 && /Admin test: which letter/.test(r.text), "editor page loads the question");
  r = await admin("/admin/questions?q=Admin%20test"); ok(/Admin test: which letter/.test(r.text), "list search finds it");
  r = await put(admin, `/api/admin/questions/${qid}`, goodQ({ prompt: "Admin test: EDITED prompt?", difficulty: 4 })); ok(r.status === 200 && r.json.version === 2, "edit bumps version to 2");
  r = await admin(`/admin/questions/${qid}`); ok(/v1/.test(r.text) && /Version history/.test(r.text), "version history lists v1");
  r = await post(admin, `/api/admin/questions/${qid}/restore`, { version: 1 }); ok(r.status === 200 && r.json.version === 3, "restore creates version 3");
  dbq = await db.question.findUnique({ where: { id: qid } }); ok(dbq.prompt === "Admin test: which letter comes after A?" && dbq.difficulty === 2, "restore brought back v1 content");
  ok((await db.questionVersion.count({ where: { questionId: qid } })) === 2, "two snapshots kept (v1, v2)");
  r = await del(admin, `/api/admin/questions/${qid}`); ok(r.status === 200 && r.json.retired === false, "unused question is deleted");
  ok(!(await db.question.findUnique({ where: { id: qid } })), "gone from the database (options/versions cascade)");

  console.log("integrity: edits to questions that already have answers");
  r = await post(admin, "/api/admin/questions", goodQ({ prompt: "Admin test: used question?" })); const uid = r.json.id;
  const used = await db.question.findUnique({ where: { id: uid }, include: { options: { orderBy: { position: "asc" } } } });
  const sess = await db.assessmentSession.create({ data: { assessmentId: (await db.assessment.findFirst()).id, userId: userRow.id } });
  await db.userAnswer.create({ data: { sessionId: sess.id, position: 1, questionId: uid, difficulty: 2, optionId: used.options[0].id, isCorrect: true, resolved: true } });
  const asInput = (patch = {}, optPatch = (o) => o) => goodQ({ prompt: used.prompt, options: used.options.map((o) => optPatch({ id: o.id, label: o.label, isCorrect: o.isCorrect })), ...patch });
  r = await put(admin, `/api/admin/questions/${uid}`, asInput({}, (o) => ({ ...o, isCorrect: o.label === "C" }))); ok(r.status === 409, "changing the answer key is refused once answered");
  r = await put(admin, `/api/admin/questions/${uid}`, asInput({ categorySlug: "verbal" })); ok(r.status === 409, "changing the category is refused");
  r = await put(admin, `/api/admin/questions/${uid}`, asInput({ options: [...used.options.map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect })), { label: "Q", isCorrect: false }] })); ok(r.status === 409, "adding an option is refused");
  r = await put(admin, `/api/admin/questions/${uid}`, asInput({ explanation: "Updated explanation text." }, (o) => (o.label === "Z" ? { ...o, label: "Zed" } : o))); ok(r.status === 200, "explanation and option wording can still be fixed");
  ok((await db.questionOption.findUnique({ where: { id: used.options[3].id } })).label === "Zed", "option label updated in place (same id)");
  r = await del(admin, `/api/admin/questions/${uid}`); ok(r.status === 200 && r.json.retired === true, "used question is retired, not deleted");
  const after = await db.question.findUnique({ where: { id: uid } }); ok(after && after.active === false, "retired question still exists (history intact) but inactive");
  await db.assessmentSession.delete({ where: { id: sess.id } }); await db.question.delete({ where: { id: uid } });

  console.log("secure uploads");
  r = await upload(admin, PNG, "pixel.png", "image/png"); ok(r.status === 200 && /^\/api\/assets\/[a-f0-9]{32}\.png$/.test(r.json.url), `valid PNG accepted (${r.json?.url?.slice(0, 30)}…)`);
  const url = r.json.url;
  const got = await fetch(B + url); const buf = Buffer.from(await got.arrayBuffer());
  ok(got.status === 200 && got.headers.get("content-type") === "image/png" && buf.equals(PNG), "served back identically with the right content type");
  ok(got.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(got.headers.get("content-security-policy") ?? ""), "served with nosniff + sandbox CSP");
  r = await upload(admin, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "x.svg", "image/svg+xml"); ok(r.status === 415, "SVG rejected");
  r = await upload(admin, Buffer.from("<html><script>alert(1)</script></html>"), "evil.png", "image/png"); ok(r.status === 415, "HTML disguised as .png rejected (magic bytes)");
  r = await upload(admin, Buffer.concat([PNG.subarray(0, 8), Buffer.alloc(3 * 1024 * 1024)]), "big.png", "image/png"); ok(r.status === 413, "oversized file rejected");
  r = await upload(user, PNG, "pixel.png", "image/png"); ok(r.status === 403, "non-admin cannot upload");
  ok((await fetch(`${B}/api/assets/..%2F..%2Fpackage.json`)).status === 404 && (await fetch(`${B}/api/assets/${"0".repeat(32)}.png`)).status === 404 && (await fetch(`${B}/api/assets/x.png`)).status === 404, "traversal and unknown names 404");
  r = await post(admin, "/api/admin/questions", goodQ({ prompt: "Admin test: image question?", imageUrl: url })); ok(r.status === 201, "question can reference an uploaded asset");
  await db.question.delete({ where: { id: r.json.id } });

  console.log("user management");
  r = await admin("/admin/users?q=Regular"); ok(r.status === 200 && r.text.includes(userEmail), "search finds the user");
  r = await put(admin, `/api/admin/users/${userRow.id}`, { roleName: "NOPE" }); ok(r.status === 400, "unknown role rejected");
  r = await put(admin, `/api/admin/users/${adminRow.id}`, { roleName: "USER" }); ok(r.status === 409, "an admin cannot demote themselves");
  r = await put(admin, `/api/admin/users/${adminRow.id}`, { disabled: true }); ok(r.status === 409, "an admin cannot suspend themselves");
  r = await put(admin, `/api/admin/users/${userRow.id}`, { roleName: "ADMIN" }); ok(r.status === 200, "promote user to ADMIN");
  r = await user("/admin"); ok(r.status === 200, "promoted user can now open /admin");
  r = await put(admin, `/api/admin/users/${userRow.id}`, { roleName: "USER" }); ok(r.status === 200, "demote back to USER");
  r = await user("/admin"); ok(r.status === 404, "demotion takes effect immediately");
  r = await put(admin, `/api/admin/users/${userRow.id}`, { disabled: true }); ok(r.status === 200, "suspend user");
  r = await user("/api/auth/me"); ok(r.json.user === null, "suspended user's existing session stops working immediately");
  r = await post(client(), "/api/auth/login", { email: userEmail, password: "Str0ngPassw0rd" }); ok(r.status === 403, "suspended user cannot log in");
  r = await put(admin, `/api/admin/users/${userRow.id}`, { disabled: false }); ok(r.status === 200, "restore user");
  r = await post(user, "/api/auth/login", { email: userEmail, password: "Str0ngPassw0rd" }); ok(r.status === 200, "restored user can log in again");
  r = await admin(`/admin/users/${userRow.id}`); ok(/user\.update/.test(r.text), "user detail shows audit activity");

  console.log("assessments");
  const A = { slug: "admin-test-set", titleEn: "Admin Test Set", titleMn: "Туршилтын багц", descEn: "Created by test", descMn: "Тест үүсгэсэн", questionCount: 8, durationSec: null, adaptive: true, categorySlugs: ["logical", "numerical"], active: true };
  r = await post(admin, "/api/admin/assessments", { ...A, slug: "Bad Slug" }); ok(r.status === 400, "invalid slug rejected");
  // The bank is large, so ask for more questions than exist at ONE difficulty level (the form allows at most 60 per test).
  const atLevel5 = await db.question.count({ where: { active: true, difficulty: 5, category: { slug: { in: ["logical", "numerical"] } } } });
  r = await post(admin, "/api/admin/assessments", { ...A, difficultyMin: 5, difficultyMax: 5, questionCount: 60 });
  ok(atLevel5 < 60 && r.status === 400 && new RegExp(`Only ${atLevel5} servable questions`).test(r.json.error), `more questions than can be served is rejected, naming how many can be served (${atLevel5} at difficulty 5)`);
  r = await post(admin, "/api/admin/assessments", { ...A, categorySlugs: ["nope"] }); ok(r.status === 400, "unknown category rejected");
  r = await post(admin, "/api/admin/assessments", A); ok(r.status === 201, "assessment created");
  const aid = r.json.id;
  r = await post(admin, "/api/admin/assessments", A); ok(r.status === 409, "duplicate slug rejected");
  r = await anon("/assessments"); ok(/Admin Test Set/.test(r.text), "new assessment appears in the public catalog");
  r = await put(admin, `/api/admin/assessments/${aid}`, { ...A, titleEn: "Admin Test Set (renamed)" }); ok(r.status === 200 && r.json.version === 1, "cosmetic edit keeps version 1");
  r = await put(admin, `/api/admin/assessments/${aid}`, { ...A, slug: "other" }); ok(r.status === 409, "slug is immutable");
  // rankings: opted-in user takes it, then a material change makes old results non-comparable
  await db.user.update({ where: { id: userRow.id }, data: { showOnLeaderboard: true } });
  await play(user, "admin-test-set", 8);
  let lb = await anon("/leaderboard?a=admin-test-set"); ok(/Regular/.test(lb.text), "result at version 1 is ranked");
  r = await put(admin, `/api/admin/assessments/${aid}`, { ...A, questionCount: 9 }); ok(r.status === 200 && r.json.version === 2, "changing question count bumps version to 2");
  lb = await anon("/leaderboard?a=admin-test-set"); ok(!/Regular/.test(lb.text), "old-version results are no longer ranked (not comparable)");
  ok((await db.assessmentResult.findFirst({ where: { userId: userRow.id }, orderBy: { createdAt: "desc" } })).assessmentVersion === 1, "result records the version it was taken on");
  r = await put(admin, `/api/admin/assessments/${aid}`, { ...A, questionCount: 9, active: false }); ok(r.status === 200, "deactivate assessment");
  r = await anon("/assessments/admin-test-set"); ok(r.status === 404, "inactive assessment is hidden");
  r = await admin("/admin/assessments"); ok(/Latest results/.test(r.text) && /Admin Test Set/.test(r.text), "admin sees results review");

  console.log("system settings, maintenance, announcements, roles");
  r = await put(admin, "/api/admin/settings", { key: "bogus", value: "1" }); ok(r.status === 400, "unknown setting rejected");
  r = await put(admin, "/api/admin/settings", { key: "maintenance", value: "yes" }); ok(r.status === 400, "invalid value rejected");
  r = await put(admin, "/api/admin/settings", { key: "maintenance", value: "1" }); ok(r.status === 200, "maintenance on");
  r = await anon("/api/status"); ok(r.json.maintenance === true, "status API reports maintenance");
  r = await post(user, "/api/sessions", { slug: "quick-check" }); ok(r.status === 503, "regular user cannot start a test during maintenance");
  r = await post(admin, "/api/sessions", { slug: "quick-check" }); ok(r.status === 200, "admin can still start a test during maintenance");
  r = await post(client(), "/api/auth/register", { name: "Late Comer", email: "late@example.com", password: "Str0ngPassw0rd" }); ok(r.status === 503, "registration blocked during maintenance");
  r = await post(user, "/api/daily", { answers: {} }); ok(r.status === 503, "daily challenge blocked during maintenance");
  await put(admin, "/api/admin/settings", { key: "maintenance", value: "0" });
  r = await anon("/api/status"); ok(r.json.maintenance === false, "maintenance off again");
  await put(admin, "/api/admin/settings", { key: "registrationOpen", value: "0" });
  r = await post(client(), "/api/auth/register", { name: "Late Comer", email: "late@example.com", password: "Str0ngPassw0rd" }); ok(r.status === 403, "registration can be closed");
  await put(admin, "/api/admin/settings", { key: "registrationOpen", value: "1" });
  await put(admin, "/api/admin/settings", { key: "leaderboardEnabled", value: "0" });
  r = await anon("/leaderboard"); ok(/currently turned off/.test(r.text), "leaderboards can be switched off");
  await put(admin, "/api/admin/settings", { key: "leaderboardEnabled", value: "1" });

  r = await post(admin, "/api/admin/announcements", { title: "x", body: "" }); ok(r.status === 400, "announcement validation");
  r = await post(admin, "/api/admin/announcements", { title: "Planned downtime", body: "Short maintenance on Sunday." }); ok(r.status === 201, "announcement published");
  const annId = r.json.id;
  r = await anon("/api/status"); ok(r.json.announcements.some((a) => a.title === "Planned downtime"), "announcement visible to everyone");
  await put(admin, `/api/admin/announcements/${annId}`, { active: false });
  r = await anon("/api/status"); ok(!r.json.announcements.some((a) => a.id === annId), "hidden announcement disappears");
  r = await del(admin, `/api/admin/announcements/${annId}`); ok(r.status === 200, "announcement deleted");

  r = await post(admin, "/api/admin/roles", { name: "admin" }); ok(r.status === 400, "role name format enforced");
  r = await post(admin, "/api/admin/roles", { name: "MODERATOR" }); ok(r.status === 201, "custom role created");
  const roleId = r.json.id;
  r = await post(admin, "/api/admin/roles", { name: "MODERATOR" }); ok(r.status === 409, "duplicate role rejected");
  r = await put(admin, `/api/admin/users/${userRow.id}`, { roleName: "MODERATOR" }); ok(r.status === 200, "assign custom role");
  r = await user("/admin"); ok(r.status === 404, "a custom role grants no admin access");
  r = await del(admin, `/api/admin/roles/${roleId}`); ok(r.status === 409, "role in use cannot be deleted");
  await put(admin, `/api/admin/users/${userRow.id}`, { roleName: "USER" });
  r = await del(admin, `/api/admin/roles/${roleId}`); ok(r.status === 200, "unused custom role deleted");
  const builtin = await db.role.findUnique({ where: { name: "ADMIN" } });
  r = await del(admin, `/api/admin/roles/${builtin.id}`); ok(r.status === 409, "built-in roles cannot be deleted");

  console.log("analytics & audit");
  r = await admin("/admin");
  const nUsers = await db.user.count();
  ok(r.status === 200 && new RegExp(`Total users[^]*?`).test(r.text) && r.text.includes(`>${nUsers}<`), `analytics shows the real user count (${nUsers})`);
  ok(/Completion rate/.test(r.text) && /Hardest questions/.test(r.text) && /Achievements unlocked/.test(r.text), "analytics sections present");
  r = await admin("/admin/audit"); ok(["question.create", "question.update", "setting.update", "user.update", "assessment.create", "role.create", "asset.upload"].every((a) => r.text.includes(a)), "audit log records admin actions");
  r = await admin("/admin/audit?a=question."); ok(/question\.create/.test(r.text) && !/setting\.update/.test(r.text), "audit filter works");
  ok((await db.auditLog.count({ where: { actorId: adminRow.id } })) > 25, "audit entries are attributed to the admin");

  await db.assessmentSession.deleteMany({});
  await db.assessment.deleteMany({ where: { slug: "admin-test-set" } });
  await db.user.deleteMany({ where: { email: { in: [adminEmail, userEmail] } } });
  await db.announcement.deleteMany({}); await db.auditLog.deleteMany({ where: { actorId: null } });
  await done();
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(2); });
