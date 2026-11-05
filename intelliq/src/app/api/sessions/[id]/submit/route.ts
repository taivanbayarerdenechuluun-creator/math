import { NextResponse } from "next/server";
import { finalize, loadOwnedSession } from "@/lib/sessions";

type Ctx = { params: Promise<{ id: string }> };

/** Idempotent: submitting twice returns the same result. The body is ignored; scores come from stored answers. */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const s = await loadOwnedSession(id);
  if (!s) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const result = s.result ?? (await finalize(s.id));
  return NextResponse.json({ resultId: result.id });
}
