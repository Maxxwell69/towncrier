import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

export default async function SignupPage() {
  const user = await getCurrentUser();

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
          Public signup is currently disabled while Twncrier is in private admin
          mode.
        </p>

        <Link
          href="/login"
          className="mt-8 block rounded-2xl bg-cyan-300 px-5 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          Go to admin login
        </Link>
      </section>
    </main>
  );
}
