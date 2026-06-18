import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Twncrier
        </Link>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/pricing" className="text-slate-300 hover:text-white">
            Pricing
          </Link>
          <Link href="/docs" className="text-slate-300 hover:text-white">
            Docs
          </Link>
          <Link
            href={user ? "/dashboard" : "/login"}
            className="rounded-full border border-white/15 px-4 py-2 text-white transition hover:bg-white/10"
          >
            {user ? "Dashboard" : "Login"}
          </Link>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            AI blog operations for local website networks
          </p>
          <h1 className="max-w-4xl text-5xl font-semibold tracking-tight sm:text-7xl">
            One hub to write, schedule, image, and publish blogs across every
            Vercel site.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Twncrier gives agencies and operators a central editorial system for
            profile-based content, weekly topic queues, Pexels images, and
            public APIs that feed each website&apos;s blog.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={user ? "/dashboard" : "/signup"}
              className="rounded-full bg-cyan-300 px-6 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              {user ? "Open dashboard" : "Start free"}
            </Link>
            <Link
              href="/docs"
              className="rounded-full border border-white/20 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/10"
            >
              See how it works
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl">
          <div className="rounded-2xl bg-slate-950 p-5">
            <p className="text-sm font-semibold text-cyan-300">
              Today&apos;s workflow
            </p>
            <div className="mt-5 space-y-4">
              {[
                "Choose an active site profile",
                "Generate from the least-used topic",
                "Auto-attach a Pexels image",
                "Review, edit, and publish",
                "Vercel blog refreshes from the API",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-white/[0.03] px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          {[
            {
              title: "Site Profiles",
              body: "Store each website's location, author, categories, service area, API slug, and revalidation settings.",
            },
            {
              title: "Editorial Calendar",
              body: "Add a bank of topics and let Twncrier rotate evenly through the least-used ideas.",
            },
            {
              title: "Vercel Blog API",
              body: "Published posts are served through clean API endpoints that your Vercel sites render at /blog.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-white/10 bg-slate-900 p-6"
            >
              <h2 className="text-xl font-semibold">{feature.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
