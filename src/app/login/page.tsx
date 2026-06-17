import Link from "next/link";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  const { error } = await searchParams;

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
        <Link href="/" className="text-sm font-semibold text-cyan-300">
          Towncrier
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Log in</h1>
        <p className="mt-2 text-sm text-slate-300">
          Use the seeded admin account to manage your GHL blog networks.
        </p>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-300/40 bg-red-500/10 p-4 text-sm text-red-100">
            Please check your email and password.
          </div>
        ) : null}

        <form action={loginAction} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-200">Email</span>
            <input
              required
              type="email"
              name="email"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 transition focus:ring-2"
              placeholder="admin@towncrier.local"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-200">
              Password
            </span>
            <input
              required
              type="password"
              name="password"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 transition focus:ring-2"
              placeholder="ChangeMe123!"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Log in
          </button>
        </form>
      </section>
    </main>
  );
}
