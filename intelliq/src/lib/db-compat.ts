/**
 * Differences between the two supported databases that application code has to know about.
 *
 * Text search: Prisma's `contains` ignores case on SQLite, but on PostgreSQL it is case-sensitive unless
 * `mode: "insensitive"` is given (and SQLite rejects that argument). The provider follows from DATABASE_URL.
 */
export const usesPostgres = (url: string | undefined = process.env.DATABASE_URL) => /^postgres(ql)?:/i.test(url ?? "");

/** A case-insensitive "contains" filter that works on both databases. */
export function containsCI(text: string, url?: string): { contains: string; mode?: "insensitive" } {
  return usesPostgres(url) ? { contains: text, mode: "insensitive" } : { contains: text };
}
