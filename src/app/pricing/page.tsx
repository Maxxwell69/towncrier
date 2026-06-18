import Link from "next/link";

const tiers = [
  {
    name: "Starter",
    price: "$49/mo",
    description: "For one local business website getting its blog moving.",
    features: [
      "1 active site profile",
      "Topic bank and manual posts",
      "Claude blog generation",
      "Pexels image automation",
      "Vercel blog API",
    ],
  },
  {
    name: "Network",
    price: "$149/mo",
    description: "For operators managing several local client websites.",
    features: [
      "Up to 10 active site profiles",
      "Weekly topic rotation",
      "Public API for every Vercel site",
      "Revalidation hooks",
      "Image attribution fields",
    ],
  },
  {
    name: "Agency",
    price: "Custom",
    description: "For larger content networks and done-for-you operations.",
    features: [
      "Unlimited site planning",
      "Custom publishing adapters",
      "Team workflows",
      "Social distribution roadmap",
      "Priority setup support",
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          Twncrier
        </Link>
        <Link
          href="/signup"
          className="rounded-full bg-cyan-300 px-5 py-2 font-semibold text-slate-950"
        >
          Start free
        </Link>
      </nav>

      <section className="mx-auto max-w-7xl py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Pricing
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight">
          Start with one site. Scale into a full blog network.
        </h1>
        <p className="mt-5 max-w-2xl text-slate-300">
          Billing is not wired into the MVP yet. These packages define the
          intended product structure for `twncrier.com`.
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <article
              key={tier.name}
              className="rounded-3xl border border-white/10 bg-white/10 p-6"
            >
              <h2 className="text-2xl font-semibold">{tier.name}</h2>
              <p className="mt-3 text-4xl font-semibold text-cyan-300">
                {tier.price}
              </p>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {tier.description}
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-200">
                {tier.features.map((feature) => (
                  <li key={feature}>- {feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
