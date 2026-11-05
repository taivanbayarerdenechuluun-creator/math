import { loadAdminStats } from "@/lib/admin-stats";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function Page() {
  return <AdminDashboard s={await loadAdminStats()} />;
}
