import "server-only";
import { NextResponse } from "next/server";
import { db } from "./db";
import { getCurrentUser, requireAdmin } from "./session";

/**
 * CSRF defence for cookie-authenticated mutations (in addition to SameSite=Lax cookies):
 * a browser always sends Origin on cross-site POSTs, so a mismatching Origin is rejected.
 */
export function crossSite(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "cross-site";
  try {
    return new URL(origin).host !== (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return true;
  }
}

export const forbidden = (msg = "Forbidden.") => NextResponse.json({ error: msg }, { status: 403 });
export const unauthorized = () => NextResponse.json({ error: "Please sign in." }, { status: 401 });

/** Signed-in user for a mutation route, or the error response to return. */
export async function userForMutation(req: Request) {
  if (crossSite(req)) return { res: forbidden("Cross-site request blocked.") } as const;
  const user = await getCurrentUser();
  if (!user) return { res: unauthorized() } as const;
  return { user } as const;
}

/** Admin for a mutation route (server-side RBAC), or the error response to return. */
export async function adminForMutation(req: Request) {
  if (crossSite(req)) return { res: forbidden("Cross-site request blocked.") } as const;
  const admin = await requireAdmin();
  if (!admin) return { res: forbidden("Administrator access required.") } as const;
  return { admin } as const;
}

export async function audit(actorId: string | null, action: string, target?: string | null, meta?: unknown) {
  await db.auditLog.create({ data: { actorId, action, target: target ?? null, meta: meta === undefined ? null : JSON.stringify(meta).slice(0, 2000) } });
}

// ---------- settings ----------
export const SETTING_DEFAULTS = { maintenance: "0", registrationOpen: "1", leaderboardEnabled: "1" } as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting(key: SettingKey) {
  return (await db.setting.findUnique({ where: { key } }))?.value ?? SETTING_DEFAULTS[key];
}
export async function getSettings() {
  const rows = await db.setting.findMany();
  return { ...SETTING_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) } as Record<SettingKey, string>;
}
export async function setSetting(key: SettingKey, value: string) {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}
export async function isMaintenance() {
  return (await getSetting("maintenance")) === "1";
}

/** A notification in English with an optional Mongolian version, shown according to the interface language. */
export async function notify(userId: string, title: string, body: string, href?: string, mn?: { title: string; body: string }) {
  await db.notification.create({ data: { userId, title, body, titleMn: mn?.title ?? null, bodyMn: mn?.body ?? null, href: href ?? null } });
}
