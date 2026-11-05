import { db } from "@/lib/db";
import { getSettings } from "@/lib/guard";
import { SystemPanel } from "@/components/admin/SystemPanel";

export default async function Page() {
  const [settings, announcements, roles] = await Promise.all([
    getSettings(),
    db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    db.role.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } }),
  ]);
  return (
    <SystemPanel
      settings={settings}
      announcements={announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, active: a.active, at: a.createdAt.toISOString().slice(0, 10) }))}
      roles={roles.map((r) => ({ id: r.id, name: r.name, users: r._count.users }))}
    />
  );
}
