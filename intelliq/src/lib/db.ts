import { Prisma, PrismaClient } from "@prisma/client";

/**
 * PostgreSQL rejects the NUL character in text ("invalid byte sequence for encoding UTF8: 0x00") while SQLite stores it,
 * so a request such as /api/sessions/%00 would end in a 500 only on PostgreSQL. NUL has no legitimate use in anything
 * this app stores or looks up, so it is removed from every query's arguments, whatever the route (path, query string or
 * JSON body). A lookup for "abc\0" therefore simply finds nothing, which the routes already answer with 404.
 */
export function stripNul(v: unknown): unknown {
  if (typeof v === "string") return v.includes("\u0000") ? v.replaceAll("\u0000", "") : v;
  if (Array.isArray(v)) return v.map(stripNul);
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stripNul(x)]));
  }
  return v; // Dates, Buffers, Prisma's own value objects, numbers, booleans, null
}

/**
 * A pooled PostgreSQL URL (Neon "-pooler" host, or anything already marked pgbouncer) needs `pgbouncer=true` for Prisma and
 * a connect timeout that survives a cold database. Hosting integrations hand out the pooled URL without those options and
 * their variables cannot be edited, so they are added here when missing. Every other URL is returned unchanged.
 */
export function runtimeDatabaseUrl(url: string | undefined): string | undefined {
  if (!url || !/^postgres(ql)?:\/\//i.test(url)) return url;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (!/-pooler\./i.test(u.hostname) && u.searchParams.get("pgbouncer") !== "true") return url;
  if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
  if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
  return u.toString();
}

const g = globalThis as unknown as { prisma?: PrismaClient };

function create(): PrismaClient {
  const configured = process.env.DATABASE_URL;
  const url = runtimeDatabaseUrl(configured);
  const extended = new PrismaClient(url && url !== configured ? { datasourceUrl: url } : undefined).$extends({
    query: {
      $allOperations({ model, args, query }) {
        return query(model ? (stripNul(args) as typeof args) : args);
      },
    },
  });
  return extended as unknown as PrismaClient; // same API; only the query arguments are sanitised
}

export const db = g.prisma ?? create();

if (process.env.NODE_ENV !== "production") g.prisma = db;

/** True when a write lost a race against a unique constraint (another request created the row first). */
export const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
