/**
 * Internal scheduler — runs entirely inside the Railway Node.js process.
 * Started once from src/instrumentation.ts when the server boots.
 *
 * Every 5 minutes it checks all active site profiles and fires the automation
 * for any that:
 *   1. Have automationEnabled = true
 *   2. Have their posting day set to today (or no specific days = every day)
 *   3. Have their postingTime hour matching the current hour (UTC)
 *   4. Have not already run today (lastAutoRunDate is not today)
 */

import {
  getNetworksScheduledForToday,
  runAutomationForNetwork,
  todayDayName,
} from "@/lib/automation";
import { prisma } from "@/lib/db";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes

function currentHourUTC() {
  return new Date().getUTCHours();
}

function todayDateStringUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function runSchedulerTick() {
  const day = todayDayName();
  const hourUTC = currentHourUTC();
  const todayStr = todayDateStringUTC();

  const networks = await getNetworksScheduledForToday();

  for (const network of networks) {
    const config = network.blogConfig;
    if (!config) continue;

    // Parse the configured posting hour (stored as "HH:MM" in UTC).
    const [postHour] = (config.postingTime ?? "08:00").split(":").map(Number);

    if (postHour !== hourUTC) {
      continue;
    }

    // Check lastAutoRunDate — skip if we already ran for this network today.
    const dbConfig = await prisma.blogConfig.findUnique({
      where: { networkId: network.id },
      select: { lastAutoRunDate: true },
    });

    if (dbConfig?.lastAutoRunDate) {
      const lastRunStr = dbConfig.lastAutoRunDate.toISOString().slice(0, 10);
      if (lastRunStr === todayStr) {
        console.log(
          `[scheduler] ${network.name} already ran today — skipping`,
        );
        continue;
      }
    }

    // Mark as started so parallel ticks don't double-fire.
    await prisma.blogConfig.update({
      where: { networkId: network.id },
      data: { lastAutoRunDate: new Date() },
    });

    console.log(
      `[scheduler] Running automation for "${network.name}" (day=${day}, hour=${hourUTC}UTC)`,
    );

    runAutomationForNetwork(network)
      .then((result) => {
        console.log(`[scheduler] Done — ${network.name}:`, JSON.stringify(result));
      })
      .catch((err) => {
        console.error(`[scheduler] Error — ${network.name}:`, err);
      });
  }
}

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  console.log(
    `[scheduler] Started — checking every ${CHECK_INTERVAL_MS / 60_000} minutes`,
  );

  // Run once shortly after boot in case the server restarted at posting time.
  setTimeout(() => {
    runSchedulerTick().catch((e) =>
      console.error("[scheduler] Initial tick failed:", e),
    );
  }, 15_000);

  setInterval(() => {
    runSchedulerTick().catch((e) =>
      console.error("[scheduler] Tick failed:", e),
    );
  }, CHECK_INTERVAL_MS);
}
