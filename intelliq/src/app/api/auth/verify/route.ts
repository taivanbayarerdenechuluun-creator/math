import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const dest = (q: string) => NextResponse.redirect(new URL(`/login?${q}`, url.origin));
  if (!token || token.length < 20) return dest("verified=0");
  const user = await db.user.findUnique({ where: { verifyToken: token } });
  if (!user) return dest("verified=0");
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), verifyToken: null } });
  return dest("verified=1");
}
