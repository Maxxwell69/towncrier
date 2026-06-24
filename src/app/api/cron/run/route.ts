import {
  getNetworksScheduledForToday,
  runAutomationForNetwork,
  todayDayName,
} from "@/lib/automation";

/**
 * GET /api/cron/run
 *
 * Called by a Railway Cron job (or any external scheduler) to generate and
 * publish blog posts for every site profile that has automation enabled and
 * is scheduled to post today.
 *
 * Secured by the CRON_SECRET environment variable — callers must pass it in
 * the Authorization header as a Bearer token.
 *
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const auth = request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (token !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const started = Date.now();
  console.log(`[cron] Run started — day: ${todayDayName()}`);

  const networks = await getNetworksScheduledForToday();
  console.log(`[cron] ${networks.length} network(s) scheduled for today`);

  const results = await Promise.allSettled(
    networks.map((n) => runAutomationForNetwork(n)),
  );

  const summary = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { error: String(r.reason), networkId: "unknown", networkName: "unknown" },
  );

  const elapsed = Date.now() - started;
  console.log(`[cron] Run finished in ${elapsed}ms`, JSON.stringify(summary));

  return Response.json({
    ok: true,
    day: todayDayName(),
    networksProcessed: networks.length,
    elapsed,
    results: summary,
  });
}
