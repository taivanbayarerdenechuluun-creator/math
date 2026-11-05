/**
 * Structured server-side error logging. Next.js calls this for every unhandled error in routes,
 * pages and server actions. One JSON line per error so any log collector can parse it.
 * No request bodies, cookies or user data are logged.
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  const e = err as { message?: string; digest?: string; stack?: string };
  console.error(
    JSON.stringify({
      level: "error",
      ts: new Date().toISOString(),
      message: e?.message ?? String(err),
      digest: e?.digest,
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      type: context.routeType,
      stack: process.env.NODE_ENV === "production" ? undefined : e?.stack?.split("\n").slice(0, 6),
    }),
  );
}
