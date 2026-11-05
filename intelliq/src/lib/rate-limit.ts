// Fixed-window in-memory limiter. Adequate for a single instance; swap for
// Redis/Upstash when running multiple instances.
const hits = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  // Test-only escape hatch; ignored in production builds.
  if (process.env.NODE_ENV !== "production" && process.env.DISABLE_RATE_LIMIT === "1") return true;
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  h.n += 1;
  return h.n <= limit;
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}
