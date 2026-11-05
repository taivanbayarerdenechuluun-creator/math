import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const prefs = await db.userPreference.findUnique({ where: { userId: user.id } });
  return (
    <SettingsView
      u={{ id: user.id, name: user.name, email: user.email, verified: !!user.emailVerifiedAt, hasImage: !!user.imageUrl, showOnLeaderboard: user.showOnLeaderboard, publicProfile: user.publicProfile, theme: prefs?.theme ?? "dark", language: prefs?.language ?? "en", isAdmin: user.role.name === "ADMIN" }}
    />
  );
}
