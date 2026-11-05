import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit, userForMutation } from "@/lib/guard";
import { destroySession } from "@/lib/session";
import { deleteObject } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { nameField } from "@/lib/validation";

const patch = z
  .object({
    name: nameField,
    theme: z.enum(["dark", "light"]),
    language: z.enum(["en", "mn"]),
    showOnLeaderboard: z.boolean(),
    publicProfile: z.boolean(),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Nothing to update");

export async function PATCH(req: Request) {
  const g = await userForMutation(req);
  if ("res" in g) return g.res;
  const p = patch.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0].message }, { status: 400 });
  const { theme, language, ...userFields } = p.data;

  await db.$transaction([
    ...(Object.keys(userFields).length ? [db.user.update({ where: { id: g.user.id }, data: userFields })] : []),
    ...(theme || language ? [db.userPreference.upsert({ where: { userId: g.user.id }, update: { ...(theme ? { theme } : {}), ...(language ? { language } : {}) }, create: { userId: g.user.id, ...(theme ? { theme } : {}), ...(language ? { language } : {}) } })] : []),
  ]);
  return NextResponse.json({ ok: true });
}

const del = z.object({ password: z.string().min(1).max(128) });

/** Permanently deletes the account and all personal data (sessions, results, reports, XP, badges, avatar). */
export async function DELETE(req: Request) {
  const g = await userForMutation(req);
  if ("res" in g) return g.res;
  if (!rateLimit(`acctdel:${g.user.id}`, 5, 60_000 * 15)) return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  const p = del.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Password required." }, { status: 400 });

  const row = await db.user.findUniqueOrThrow({ where: { id: g.user.id }, select: { passwordHash: true, imageUrl: true } });
  if (!(await bcrypt.compare(p.data.password, row.passwordHash))) return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
  if (g.user.role.name === "ADMIN" && (await db.user.count({ where: { role: { name: "ADMIN" }, disabledAt: null } })) <= 1)
    return NextResponse.json({ error: "You are the only administrator. Promote another admin before deleting this account." }, { status: 409 });

  await db.$transaction([
    db.assessmentSession.deleteMany({ where: { userId: g.user.id } }), // cascades to answers, results, category results, reports
    db.auditLog.updateMany({ where: { actorId: g.user.id }, data: { actorId: null } }),
    db.user.delete({ where: { id: g.user.id } }), // cascades to prefs, streak, XP, badges, challenge attempts, notifications, bookmarks
  ]);
  if (row.imageUrl) await deleteObject(`avatars/${g.user.id}.${row.imageUrl.split(".").pop()}`);
  await audit(null, "account.delete", g.user.id);
  await destroySession();
  return NextResponse.json({ ok: true });
}
