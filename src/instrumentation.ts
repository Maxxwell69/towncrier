/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * On Railway this process stays alive permanently, so the scheduler loop
 * keeps running for the lifetime of the deployment.
 *
 * @see https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  // Only run in the Node.js runtime (not Edge/Middleware).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
