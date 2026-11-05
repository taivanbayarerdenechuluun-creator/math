import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { userForMutation } from "@/lib/guard";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, body: true, titleMn: true, bodyMn: true, href: true, readAt: true, createdAt: true } });
  return NextResponse.json({ items: items.map((n) => ({ ...n, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() })) }, { headers: { "Cache-Control": "no-store" } });
}

const body = z.union([z.object({ markAll: z.literal(true) }), z.object({ id: z.string().min(1).max(40) })]);

/** Marks notifications read. Always scoped to the signed-in user, so IDs of others' notifications do nothing. */
export async function POST(req: Request) {
  const g = await userForMutation(req);
  if ("res" in g) return g.res;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const where = "markAll" in p.data ? { userId: g.user.id, readAt: null } : { userId: g.user.id, id: p.data.id, readAt: null };
  const r = await db.notification.updateMany({ where, data: { readAt: new Date() } });
  return NextResponse.json({ updated: r.count });
}
