/**
 * Internal scheduler — runs entirely inside the Railway Node.js process.
 * Started once from src/instrumentation.ts when the server boots.
 *
 * Every 5 minutes it checks all active site profiles and fires the automation
 * for any that:
 *   1. Have automationEnabled = true
 *   2. Have their posting day set to today in their local timezone
 *      (or no days configured = every day)
 *   3. Have their postingTime hour matching the current hour in their timezone
 *   4. Have not already run today in their local timezone
 */

import {
  getNetworksScheduledForToday,
  runAutomationForNetwork,
} from "@/lib/automation";
import { prisma } from "@/lib/db";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * Returns the current hour (0–23) and day name in the given IANA timezone.
 * Falls back to UTC if the timezone string is invalid.
 */
function localTimeFor(timezone: string): { hour: number; day: string; dateStr: string } {
  let tz = timezone;
  try {
    // Validate the timezone — throws RangeError if unknown.
    Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    console.warn(`[scheduler] Unknown timezone "${tz}", falling back to UTC`);
    tz = "UTC";
  }

  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const hourRaw = parseInt(get("hour"), 10);
  // Intl uses 24 for midnight in some locales — normalise to 0.
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const weekday = get("weekday").toLowerCase();
  const day = DAY_NAMES.includes(weekday) ? weekday : DAY_NAMES[new Date().getDay()];

  const month = get("month");
  const dayOfMonth = get("day");
  const year = get("year");
  const dateStr = `${year}-${month}-${dayOfMonth}`;

  return { hour, day, dateStr };
}

async function runSchedulerTick() {
  const networks = await getNetworksScheduledForToday();

  for (const network of networks) {
    const config = network.blogConfig;
    if (!config) continue;

    const timezone = config.timezone ?? "America/New_York";
    const { hour, day, dateStr } = localTimeFor(timezone);

    // Check posting days in local timezone.
    const days = config.postingDays ?? [];
    if (days.length > 0 && !days.map((d) => d.toLowerCase()).includes(day)) {
      continue;
    }

    // Check posting hour in local timezone.
    const [postHour] = (config.postingTime ?? "08:00").split(":").map(Number);
    if (postHour !== hour) {
      continue;
    }

    // Check lastAutoRunDate — skip if already ran today in local timezone.
    const dbConfig = await prisma.blogConfig.findUnique({
      where: { networkId: network.id },
      select: { lastAutoRunDate: true },
    });

    if (dbConfig?.lastAutoRunDate) {
      const lastLocal = localTimeFor(timezone);
      // Re-derive the date string from the stored timestamp in local tz.
      const storedDate = new Date(dbConfig.lastAutoRunDate);
      const storedDateStr = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .format(storedDate)
        .replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");

      if (storedDateStr === dateStr) {
        console.log(
          `[scheduler] "${network.name}" already ran today (${timezone}) — skipping`,
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
      `[scheduler] Running automation for "${network.name}" (${timezone} — ${day} ${postHour}:00)`,
    );

    runAutomationForNetwork(network)
      .then((result) => {
        console.log(
          `[scheduler] Done — "${network.name}":`,
          JSON.stringify(result),
        );
      })
      .catch((err) => {
        console.error(`[scheduler] Error — "${network.name}":`, err);
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
