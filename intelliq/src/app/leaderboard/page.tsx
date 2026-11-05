import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { loadBoard } from "@/lib/leaderboard.server";
import type { Scope } from "@/lib/leaderboard";
import { getSetting } from "@/lib/guard";
import { LeaderboardView } from "@/components/history/LeaderboardView";

export const metadata: Metadata = { title: "Leaderboard", description: "Opt-in rankings of practice performance." };
export const dynamic = "force-dynamic";

const SCOPES: Scope[] = ["global", "weekly", "monthly"];

export default async function Page({ searchParams }: { searchParams: Promise<{ scope?: string; a?: string; c?: string }> }) {
  const sp = await searchParams;
  const scope = SCOPES.includes(sp.scope as Scope) ? (sp.scope as Scope) : "global";
  const user = await getCurrentUser();
  const enabled = (await getSetting("leaderboardEnabled")) === "1";
  const slug = (sp.a ?? "full-battery").slice(0, 60);
  const category = sp.c && /^[a-z]{3,12}$/.test(sp.c) ? sp.c : null;
  const board = await loadBoard({ scope, slug, category, viewerId: user?.id ?? null });
  return <LeaderboardView board={board} scope={scope} slug={slug} category={category} signedIn={!!user} enabled={enabled} />;
}
