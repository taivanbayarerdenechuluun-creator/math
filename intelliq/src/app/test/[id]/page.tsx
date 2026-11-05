import type { Metadata } from "next";
import { TestRunner } from "@/components/test/TestRunner";

export const metadata: Metadata = { title: "Assessment in progress", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TestRunner sessionId={id} />;
}
