import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Server-side RBAC: anonymous -> login, signed-in non-admins get a 404 (the panel's existence is not revealed). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role.name !== "ADMIN") notFound();
  return <AdminShell name={user.name}>{children}</AdminShell>;
}
