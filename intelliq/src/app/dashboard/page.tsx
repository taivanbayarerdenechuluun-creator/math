import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { loadDashboard } from "@/lib/dashboard";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <DashboardView d={await loadDashboard(user.id, user.name, user.xp)} unverifiedEmail={user.emailVerifiedAt ? null : user.email} />;
}
