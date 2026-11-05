import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { loadOwnedResult } from "@/lib/results";
import { CertificateView } from "@/components/results/CertificateView";

export const metadata: Metadata = { title: "Participation certificate", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadOwnedResult(id);
  if (!r) notFound();
  const user = await getCurrentUser();
  return <CertificateView name={user?.name ?? "Guest participant"} titleEn={r.titleEn} titleMn={r.titleMn} date={r.createdAt.slice(0, 10)} code={r.reportCode} resultId={r.id} />;
}
