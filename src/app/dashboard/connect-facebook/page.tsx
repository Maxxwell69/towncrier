import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { connectFacebookPageAction } from "@/app/actions/networks";
import { SubmitButton } from "@/components/submit-button";
import { requireUser } from "@/lib/auth";
import { FB_PAGES_COOKIE } from "@/app/api/auth/facebook/callback/route";
import type { FacebookPage } from "@/app/api/auth/facebook/callback/route";

export default async function ConnectFacebookPage({
  searchParams,
}: {
  searchParams: Promise<{ networkId?: string }>;
}) {
  await requireUser();
  const { networkId } = await searchParams;

  const cookieStore = await cookies();
  const raw = cookieStore.get(FB_PAGES_COOKIE)?.value;

  if (!raw || !networkId) {
    redirect("/dashboard?fb_error=Session+expired.+Please+try+connecting+again.");
  }

  let pages: FacebookPage[] = [];
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));
    pages = decoded.pages ?? [];
  } catch {
    redirect("/dashboard?fb_error=Failed+to+read+page+data.+Please+try+again.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Facebook
          </p>
          <h1 className="mt-1 text-2xl font-bold">Choose a page to connect</h1>
          <p className="mt-2 text-sm text-slate-600">
            Select the Facebook Page that should receive blog posts from this
            site profile.
          </p>
        </div>

        <form action={connectFacebookPageAction} className="space-y-4">
          <input type="hidden" name="networkId" value={networkId} />

          <div className="space-y-2">
            {pages.map((page) => (
              <label
                key={page.id}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-cyan-300 has-[:checked]:border-cyan-400 has-[:checked]:bg-cyan-50"
              >
                <input
                  type="radio"
                  name="pageId"
                  value={page.id}
                  required
                  className="mt-0.5 accent-cyan-500"
                />
                <div>
                  <p className="font-semibold">{page.name}</p>
                  {page.category ? (
                    <p className="text-xs text-slate-500">{page.category}</p>
                  ) : null}
                  <p className="mt-0.5 font-mono text-xs text-slate-400">
                    ID: {page.id}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <SubmitButton
            className="w-full rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-500"
            pendingText="Connecting page..."
          >
            Connect this page
          </SubmitButton>
        </form>

        <a
          href="/dashboard"
          className="mt-4 block text-center text-sm text-slate-500 underline"
        >
          Cancel
        </a>
      </div>
    </main>
  );
}
