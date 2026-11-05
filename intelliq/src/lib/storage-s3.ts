// S3-compatible object store (AWS S3, Cloudflare R2, MinIO, Backblaze B2, …). No Next/server-only imports, so it can be
// tested directly against an S3 server; src/lib/storage.ts selects it with STORAGE_DRIVER=s3.
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";

type Env = Record<string, string | undefined>;
export type ObjectStore = {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** The object's bytes, or null when the key does not exist. Other failures (no such bucket, bad credentials, network) throw. */
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
};

const flag = (v: string | undefined, fallback: boolean) => (v === undefined || v.trim() === "" ? fallback : /^(1|true|yes|on)$/i.test(v.trim()));

export function s3Config(env: Env = process.env) {
  const bucket = env.S3_BUCKET?.trim();
  if (!bucket) throw new Error("S3_BUCKET is not set");
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim(), secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required");
  const endpoint = env.S3_ENDPOINT?.trim() || undefined;
  const prefix = (env.S3_PREFIX ?? "").trim().replace(/^\/+/, "").replace(/\/*$/, "");
  return {
    bucket,
    region: env.S3_REGION?.trim() || "us-east-1",
    endpoint,
    // custom endpoints (MinIO, R2, …) normally need path-style addressing; AWS itself does not
    forcePathStyle: flag(env.S3_FORCE_PATH_STYLE, !!endpoint),
    prefix: prefix ? `${prefix}/` : "",
    credentials: { accessKeyId, secretAccessKey },
  };
}

const isMissingKey = (e: unknown) => e instanceof S3ServiceException && (e.name === "NoSuchKey" || e.name === "NotFound");

export function createS3Store(env: Env = process.env): ObjectStore {
  const c = s3Config(env);
  const client = new S3Client({
    region: c.region, endpoint: c.endpoint, forcePathStyle: c.forcePathStyle, credentials: c.credentials,
    maxAttempts: 3, requestHandler: { connectionTimeout: 5_000, requestTimeout: 20_000 },
  });
  const Key = (key: string) => c.prefix + key;
  return {
    async put(key, data, contentType) {
      await client.send(new PutObjectCommand({ Bucket: c.bucket, Key: Key(key), Body: data, ContentType: contentType, ContentLength: data.length, CacheControl: "private, max-age=3600" }));
    },
    async get(key) {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: c.bucket, Key: Key(key) }));
        return Buffer.from(await out.Body!.transformToByteArray());
      } catch (e) {
        if (isMissingKey(e)) return null;
        throw e;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: Key(key) })); // S3 answers 204 for a key that does not exist
    },
  };
}
