"use client";

export type ApiResult<T = Record<string, unknown>> = { ok: boolean; status: number; data: T & { error?: string } };

export async function adminApi<T = Record<string, unknown>>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<ApiResult<T>> {
  const r = await fetch(`/api/admin/${path}`, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export async function adminUpload(file: File): Promise<ApiResult<{ url?: string }>> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch("/api/admin/upload", { method: "POST", body: form });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}
