import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto flex max-w-5xl flex-col gap-10">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Towncrier
          </p>
          <h1 className="text-5xl font-semibold tracking-tight sm:text-7xl">
            Daily GHL blog publishing for every site in your network.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Add a GoHighLevel blog, save the topic strategy, generate a Claude
            draft, and publish it from one simple dashboard.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={user ? "/dashboard" : "/login"}
            className="rounded-full bg-cyan-300 px-6 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            {user ? "Open dashboard" : "Log in"}
          </Link>
          <a
            href="https://railway.com"
            className="rounded-full border border-white/20 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/10"
          >
            Built for Railway
          </a>
        </div>
      </section>
    </main>
  );
}
