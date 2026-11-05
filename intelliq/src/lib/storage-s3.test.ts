import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import S3rver from "s3rver";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createS3Store, s3Config } from "./storage-s3";

// A real S3 protocol server (signature checking included) on a local port; no network, no cloud account.
const PORT = 4571;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "intelliq-s3-"));
let server: { run(): Promise<unknown>; close(): Promise<void> };

const env = (extra: Record<string, string> = {}) => ({
  S3_ENDPOINT: `http://127.0.0.1:${PORT}`, S3_BUCKET: "intelliq-test", S3_ACCESS_KEY_ID: "S3RVER", S3_SECRET_ACCESS_KEY: "S3RVER", S3_REGION: "us-east-1", ...extra,
});

before(async () => {
  server = new S3rver({ port: PORT, address: "127.0.0.1", silent: true, directory: dir, configureBuckets: [{ name: "intelliq-test", configs: [] }] });
  await server.run();
});
after(async () => {
  await server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

test("put, get, overwrite and delete round-trip binary data exactly", async () => {
  const s = createS3Store(env());
  const big = randomBytes(300_000);
  await s.put("avatars/user_1.png", big, "image/png");
  assert.ok((await s.get("avatars/user_1.png"))!.equals(big), "300 KB of random bytes come back identical");
  await s.put("avatars/user_1.png", PNG, "image/png");
  assert.ok((await s.get("avatars/user_1.png"))!.equals(PNG), "a second put replaces the object");
  await s.delete("avatars/user_1.png");
  assert.equal(await s.get("avatars/user_1.png"), null, "deleted objects are gone");
});

test("a missing key is null, and deleting one is not an error", async () => {
  const s = createS3Store(env());
  assert.equal(await s.get("assets/does-not-exist.png"), null);
  await s.delete("assets/does-not-exist.png");
});

test("the content type is stored with the object", async () => {
  const s = createS3Store(env());
  await s.put("assets/typed.webp", PNG, "image/webp");
  const head = await new S3Client({ region: "us-east-1", endpoint: `http://127.0.0.1:${PORT}`, forcePathStyle: true, credentials: { accessKeyId: "S3RVER", secretAccessKey: "S3RVER" } }).send(new HeadObjectCommand({ Bucket: "intelliq-test", Key: "assets/typed.webp" }));
  assert.equal(head.ContentType, "image/webp");
  assert.equal(head.ContentLength, PNG.length);
  await s.delete("assets/typed.webp");
});

test("S3_PREFIX keeps several apps apart in one bucket", async () => {
  const a = createS3Store(env({ S3_PREFIX: "/app-a/" })), b = createS3Store(env({ S3_PREFIX: "app-b" })), raw = createS3Store(env());
  await a.put("assets/shared.png", Buffer.from("A"), "image/png");
  await b.put("assets/shared.png", Buffer.from("B"), "image/png");
  assert.equal((await a.get("assets/shared.png"))!.toString(), "A");
  assert.equal((await b.get("assets/shared.png"))!.toString(), "B");
  assert.equal((await raw.get("app-a/assets/shared.png"))!.toString(), "A", "the prefix is a real key prefix");
  await a.delete("assets/shared.png");
  assert.equal(await a.get("assets/shared.png"), null);
  assert.equal((await b.get("assets/shared.png"))!.toString(), "B", "deleting under one prefix leaves the other alone");
  await b.delete("assets/shared.png");
});

test("failures other than 'no such key' are errors, never a silent null", async () => {
  // (the local test server checks the access key id but not the signature secret; real S3 checks both)
  await assert.rejects(() => createS3Store(env({ S3_ACCESS_KEY_ID: "not-a-key" })).get("assets/x.png"), /InvalidAccessKeyId|access key/i, "bad credentials");
  await assert.rejects(() => createS3Store(env({ S3_BUCKET: "no-such-bucket" })).get("assets/x.png"), /bucket|NoSuchBucket|not exist/i, "missing bucket");
  await assert.rejects(() => createS3Store(env({ S3_BUCKET: "no-such-bucket" })).put("assets/x.png", PNG, "image/png"), /bucket|NoSuchBucket|not exist/i, "upload to a missing bucket");
  const t0 = Date.now();
  await assert.rejects(() => createS3Store(env({ S3_ENDPOINT: "http://127.0.0.1:1" })).get("assets/x.png"), () => true, "unreachable endpoint");
  assert.ok(Date.now() - t0 < 15_000, "and it fails in reasonable time");
});

test("configuration is validated with clear messages", () => {
  assert.throws(() => s3Config({}), /S3_BUCKET/);
  assert.throws(() => s3Config({ S3_BUCKET: "b" }), /S3_ACCESS_KEY_ID/);
  assert.throws(() => s3Config({ S3_BUCKET: "b", S3_ACCESS_KEY_ID: "a" }), /S3_SECRET_ACCESS_KEY/);
  const c = s3Config({ S3_BUCKET: "b", S3_ACCESS_KEY_ID: "a", S3_SECRET_ACCESS_KEY: "s" });
  assert.deepEqual([c.region, c.endpoint, c.forcePathStyle, c.prefix], ["us-east-1", undefined, false, ""], "AWS defaults: virtual-hosted style, no prefix");
  assert.equal(s3Config({ S3_BUCKET: "b", S3_ACCESS_KEY_ID: "a", S3_SECRET_ACCESS_KEY: "s", S3_ENDPOINT: "http://minio:9000" }).forcePathStyle, true, "a custom endpoint defaults to path-style");
  assert.equal(s3Config({ S3_BUCKET: "b", S3_ACCESS_KEY_ID: "a", S3_SECRET_ACCESS_KEY: "s", S3_ENDPOINT: "https://x.r2.cloudflarestorage.com", S3_FORCE_PATH_STYLE: "false" }).forcePathStyle, false, "and can be turned off");
});
