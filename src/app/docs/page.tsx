import Link from "next/link";

const steps = [
  {
    title: "Create a site profile",
    body: "Add the Vercel site slug, domain, location, author, categories, and topic strategy.",
  },
  {
    title: "Add a topic bank",
    body: "Load repeatable blog topics. Twncrier rotates through the least-used active topics.",
  },
  {
    title: "Generate or submit copy",
    body: "Use Claude to draft posts or paste your own completed blog copy into the manual form.",
  },
  {
    title: "Attach images",
    body: "Pexels can automatically attach a featured image and attribution to new drafts.",
  },
  {
    title: "Publish to the API",
    body: "Publishing makes the post available through Twncrier's site-specific public API.",
  },
  {
    title: "Render on Vercel",
    body: "Each website fetches its own posts from Twncrier and renders them at /blog.",
  },
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          Twncrier
        </Link>
        <div className="flex gap-4 text-sm font-semibold">
          <Link href="/pricing" className="text-slate-300 hover:text-white">
            Pricing
          </Link>
          <Link href="/login" className="text-slate-300 hover:text-white">
            Login
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Docs
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight">
          How Twncrier powers a Vercel blog network.
        </h1>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-3xl border border-white/10 bg-white/10 p-6"
            >
              <p className="text-sm font-semibold text-cyan-300">
                Step {index + 1}
              </p>
              <h2 className="mt-3 text-2xl font-semibold">{step.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {step.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-slate-900 p-6">
          <h2 className="text-2xl font-semibold">Vercel env vars</h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-black/30 p-4 text-sm text-cyan-100">
{`TOWNCRIER_API_URL=https://towncrier-production.up.railway.app
TOWNCRIER_SITE_SLUG=fairless-hills-chiropractor
TOWNCRIER_REVALIDATE_SECRET=optional-shared-secret`}
          </pre>
          <p className="mt-4 text-sm text-slate-300">
            Full drop-in examples live in the repository at{" "}
            <code>docs/vercel-site-integration.md</code>.
          </p>
        </div>
      </section>
    </main>
  );
}
