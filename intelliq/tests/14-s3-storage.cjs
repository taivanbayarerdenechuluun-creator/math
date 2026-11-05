// Uploads with the app in S3 mode (see tests/s3-server.cjs for how to start both). Checks where the bytes really are.
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { S3Client, HeadObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } = require("@aws-sdk/client-s3");
const L = require("./lib.cjs");
const { db, B, ok, client, post, register, done } = L;

const s3 = new S3Client({ region: "us-east-1", endpoint: "http://127.0.0.1:4570", forcePathStyle: true, credentials: { accessKeyId: "S3RVER", secretAccessKey: "S3RVER" } });
const Bucket = "intelliq-app";
const head = (Key) => s3.send(new HeadObjectCommand({ Bucket, Key })).catch(() => null);
const bytes = async (Key) => Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket, Key }))).Body.transformToByteArray());
const keys = async () => ((await s3.send(new ListObjectsV2Command({ Bucket }))).Contents ?? []).map((o) => o.Key);
const PNG = () => Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), randomBytes(300)]);
const JPG = () => Buffer.concat([Buffer.from("ffd8ffe0", "hex"), randomBytes(300)]);
const localAvatars = () => (fs.existsSync(path.join(__dirname, "..", "storage", "avatars")) ? fs.readdirSync(path.join(__dirname, "..", "storage", "avatars")) : []);

async function upload(c, url, buf, name, type, extra = {}) {
  const form = new FormData();
  form.append("file", new Blob([buf], { type }), name);
  const cookie = (await c("/api/auth/me")).cookie();
  return fetch(B + url, { method: "POST", body: form, headers: { cookie, ...extra } }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null), headers: r.headers }));
}
const fetchAs = async (c, url) => {
  const r = await fetch(B + url, { headers: { cookie: (await c("/api/auth/me")).cookie() } });
  return { status: r.status, bytes: Buffer.from(await r.arrayBuffer()), headers: r.headers };
};

(async () => {
  const stamp = Date.now();
  const u = client();
  const email = await register(u, "S3 Tester");
  const me = (await u("/api/auth/me")).json.user;
  const before = localAvatars();

  console.log("avatars go to the bucket, not to the disk");
  const png = PNG();
  let r = await upload(u, "/api/account/avatar", png, "a.png", "image/png");
  ok(r.status === 200, "an avatar upload succeeds");
  const h = await head(`avatars/${me.id}.png`);
  if (!h) { console.log("  FAIL: nothing in the bucket: is the app running with STORAGE_DRIVER=s3 and the S3 server up?"); }
  ok(!!h && h.ContentType === "image/png" && h.ContentLength === png.length, "the object is in the bucket with its content type and size");
  ok(h && (await bytes(`avatars/${me.id}.png`)).equals(png), "and holds exactly the uploaded bytes");
  ok(JSON.stringify(localAvatars()) === JSON.stringify(before), "nothing was written to ./storage on the app server's disk");
  let g = await fetchAs(u, `/api/avatar/${me.id}`);
  ok(g.status === 200 && g.bytes.equals(png) && g.headers.get("content-type") === "image/png", "the owner is served the bytes through the app");
  ok(g.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(g.headers.get("content-security-policy") || ""), "with the locked-down response headers");
  ok((await fetchAs(client(), `/api/avatar/${me.id}`)).status === 404, "other visitors still get 404 while the profile is private (the bucket is never exposed)");

  console.log("replacing and removing");
  const jpg = JPG();
  r = await upload(u, "/api/account/avatar", jpg, "a.jpg", "image/jpeg");
  ok(r.status === 200 && !!(await head(`avatars/${me.id}.jpg`)) && !(await head(`avatars/${me.id}.png`)), "a JPEG replaces the PNG: the old object is deleted from the bucket");
  g = await fetchAs(u, `/api/avatar/${me.id}`);
  ok(g.status === 200 && g.bytes.equals(jpg) && g.headers.get("content-type") === "image/jpeg", "the new image is served");
  await s3.send(new PutObjectCommand({ Bucket, Key: `avatars/${me.id}.jpg`, Body: Buffer.from("gone-soon") }));
  const stale = await db.user.update({ where: { id: me.id }, data: { imageUrl: "stale.png" } });
  ok((await fetchAs(u, `/api/avatar/${me.id}`)).status === 404, "an image recorded for the user but missing from the bucket is a 404, not a crash");
  await db.user.update({ where: { id: me.id }, data: { imageUrl: stale.imageUrl === "stale.png" ? `${me.id}.jpg` : stale.imageUrl } });
  r = await fetch(`${B}/api/account/avatar`, { method: "DELETE", headers: { cookie: (await u("/api/auth/me")).cookie() } });
  ok(r.status === 200 && !(await head(`avatars/${me.id}.jpg`)), "removing the avatar deletes the object");

  console.log("uploads are still validated before they reach the bucket");
  const evil = await upload(u, "/api/account/avatar", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"), "x.svg", "image/svg+xml");
  const disguised = await upload(u, "/api/account/avatar", Buffer.from("<html><script>alert(1)</script></html>"), "x.png", "image/png");
  ok(evil.status === 415 && disguised.status === 415, "SVG and HTML disguised as PNG are rejected");
  ok((await keys()).filter((k) => k.startsWith("avatars/")).length === 0, "and nothing was stored");

  console.log("admin question images");
  const admin = client();
  await register(admin, "S3 Admin");
  const role = await db.role.upsert({ where: { name: "ADMIN" }, update: {}, create: { name: "ADMIN" } });
  await db.user.updateMany({ where: { name: "S3 Admin" }, data: { roleId: role.id } });
  const asset = PNG();
  r = await upload(admin, "/api/admin/upload", asset, "q.png", "image/png");
  const name = r.json?.url?.split("/").pop();
  ok(r.status === 200 && /^[a-f0-9]{32}\.png$/.test(name || ""), "an admin upload returns an /api/assets URL");
  ok(!!(await head(`assets/${name}`)) && (await bytes(`assets/${name}`)).equals(asset), "the image is in the bucket under assets/");
  const served = await fetch(`${B}${r.json.url}`);
  ok(served.status === 200 && Buffer.from(await served.arrayBuffer()).equals(asset) && /immutable/.test(served.headers.get("cache-control") || ""), "it is served publicly through the app with long-lived caching");
  ok((await fetch(`${B}/api/assets/${"0".repeat(32)}.png`)).status === 404, "an unknown name is a 404");

  console.log("deleting the account removes the avatar from the bucket");
  r = await upload(u, "/api/account/avatar", PNG(), "again.png", "image/png");
  ok(r.status === 200 && !!(await head(`avatars/${me.id}.png`)), "uploaded again");
  r = await fetch(`${B}/api/account`, { method: "DELETE", body: JSON.stringify({ password: "Str0ngPassw0rd" }), headers: { "Content-Type": "application/json", cookie: (await u("/api/auth/me")).cookie() } });
  ok(r.status === 200 && !(await head(`avatars/${me.id}.png`)), "the object is gone with the account");

  await db.user.deleteMany({ where: { name: { in: ["S3 Tester", "S3 Admin"] } } });
  await done();
})().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(2); });
