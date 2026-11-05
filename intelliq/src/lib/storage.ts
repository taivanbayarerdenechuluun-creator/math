import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { sniffImage, type ImageExt } from "./image-sniff";
import { createS3Store, type ObjectStore } from "./storage-s3";

/**
 * Storage adapter: three functions, nothing else in the app touches the filesystem or a bucket. Files are always
 * served through the app (/api/assets, /api/avatar), so a bucket never has to be public.
 *   STORAGE_DRIVER=local (default)  ./storage on the server's disk (development, single server, a Docker volume)
 *   STORAGE_DRIVER=s3               any S3-compatible service; see S3_* in .env.example
 * Keys are validated before any driver sees them.
 */
const ROOT = path.join(process.cwd(), "storage");
const KEY = /^(assets|avatars)\/[a-z0-9_-]{1,64}\.(png|jpg|webp|gif)$/;

export const MIME: Record<ImageExt, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

const checked = (key: string) => {
  if (!KEY.test(key)) throw new Error("Invalid storage key");
  return key;
};
const file = (key: string) => path.join(ROOT, checked(key));

let s3: ObjectStore | null = null;
const remote = () => ((process.env.STORAGE_DRIVER ?? "local").trim().toLowerCase() === "s3" ? (s3 ??= createS3Store()) : null);

export async function putObject(key: string, data: Buffer) {
  const store = remote();
  if (store) return store.put(checked(key), data, MIME[key.split(".").pop() as ImageExt]);
  const f = file(key);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, data);
}

export async function getObject(key: string): Promise<Buffer | null> {
  const store = remote();
  if (store) return store.get(checked(key));
  try {
    return await readFile(file(key));
  } catch {
    return null;
  }
}

/** Best effort: a failure is logged, not thrown, so deleting an account is never blocked by the storage service. */
export async function deleteObject(key: string) {
  try {
    const store = remote();
    if (store) await store.delete(checked(key));
    else await unlink(file(key));
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code !== "ENOENT") console.error(`[storage] could not delete ${key}:`, e instanceof Error ? e.message : e);
  }
}

export type UploadResult = { ok: true; ext: ImageExt; bytes: Buffer } | { ok: false; error: string };

/** Validates an uploaded image by size and magic bytes (never by filename or declared type). SVG is rejected. */
export function checkImage(bytes: Buffer, maxBytes: number): UploadResult {
  if (bytes.length === 0) return { ok: false, error: "Empty file." };
  if (bytes.length > maxBytes) return { ok: false, error: `File too large (max ${Math.round(maxBytes / 1024)} KB).` };
  const ext = sniffImage(bytes);
  return ext ? { ok: true, ext, bytes } : { ok: false, error: "Unsupported file type. Use PNG, JPEG, WebP or GIF." };
}

/** Saves a question asset under an unguessable name and returns its public URL. */
export async function saveAsset(bytes: Buffer, ext: ImageExt) {
  const name = randomBytes(16).toString("hex");
  await putObject(`assets/${name}.${ext}`, bytes);
  return `/api/assets/${name}.${ext}`;
}
