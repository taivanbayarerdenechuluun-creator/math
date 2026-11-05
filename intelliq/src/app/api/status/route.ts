import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isMaintenance } from "@/lib/guard";

/** Public site status for the app chrome: maintenance flag, active announcements, and the viewer's basics. */
export async function GET() {
  const [maintenance, announcements, user] = await Promise.all([
    isMaintenance(),
    db.announcement.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, title: true, body: true } }),
    getCurrentUser(),
  ]);
  const [unread, prefs] = user ? await Promise.all([db.notification.count({ where: { userId: user.id, readAt: null } }), db.userPreference.findUnique({ where: { userId: user.id }, select: { theme: true, language: true } })]) : [0, null];
  return NextResponse.json(
    { maintenance, announcements, user: user && { id: user.id, name: user.name, role: user.role.name, hasImage: !!user.imageUrl, prefs }, unread },
    { headers: { "Cache-Control": "no-store" } },
  );
}
