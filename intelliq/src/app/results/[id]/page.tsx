import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { aiConfigured } from "@/lib/ai";
import { loadOwnedResult } from "@/lib/results";
import { ResultsView } from "@/components/results/ResultsView";

export const metadata: Metadata = { title: "Your results", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedResult(id);
  if (!result) notFound();
  return <ResultsView d={result} aiAvailable={aiConfigured()} />;
}
