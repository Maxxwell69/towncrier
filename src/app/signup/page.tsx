import Link from "next/link";
import { redirect } from "next/navigation";

import { signupAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { getCurrentUser } from "@/lib/auth";

type SignupPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const user = await getCurrentUser();
  const { error } = await searchParams;

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
        <Link href="/" className="text-sm font-semibold text-cyan-300">
          Twncrier
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm text-slate-300">
          Start building a central autoblog hub for your Vercel site network.
        </p>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-300/40 bg-red-500/10 p-4 text-sm text-red-100">
            {error === "exists"
              ? "That email already has an account. Try logging in."
              : "Use a valid email and a password of at least 8 characters."}
          </div>
        ) : null}

        <form action={signupAction} className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-200">Email</span>
            <input
              required
              type="email"
              name="email"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 transition focus:ring-2"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-200">
              Password
            </span>
            <input
              required
              minLength={8}
              type="password"
              name="password"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-cyan-300 transition focus:ring-2"
              placeholder="At least 8 characters"
            />
          </label>

          <SubmitButton
            className="w-full rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
            pendingText="Creating account..."
          >
            Create account
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-slate-300">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-cyan-300">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
