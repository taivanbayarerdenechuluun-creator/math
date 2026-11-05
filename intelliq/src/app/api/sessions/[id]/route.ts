import { NextResponse } from "next/server";
import { deadlineOf, expireIfDue, getState, loadOwnedSession } from "@/lib/sessions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const s = await loadOwnedSession(id);
  if (!s) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const expiredResult = await expireIfDue(s);
  if (expiredResult || s.status === "SUBMITTED") {
    const resultId = expiredResult ?? s.result?.id ?? null;
    return NextResponse.json({ status: "SUBMITTED", resultId }, { headers: { "Cache-Control": "no-store" } });
  }

  const state = await getState(s);
  const dl = deadlineOf(s);
  return NextResponse.json(
    {
      status: s.status,
      assessment: { slug: s.assessment.slug, titleEn: s.assessment.titleEn, titleMn: s.assessment.titleMn, total: s.assessment.questionCount },
      deadline: dl ? new Date(dl).toISOString() : null,
      serverNow: new Date().toISOString(),
      ...state,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
