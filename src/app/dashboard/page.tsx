import { logoutAction } from "@/app/actions/auth";
import {
  createNetworkAction,
  deletePostAction,
  generatePostAction,
  publishPostAction,
  updateDraftAction,
} from "@/app/actions/networks";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const postingDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

type DashboardPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const user = await requireUser();
  const { error } = await searchParams;
  const networks = await prisma.network.findMany({
    where: { ownerId: user.id },
    include: {
      blogConfig: true,
      posts: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-8 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Towncrier
            </p>
            <h1 className="mt-3 text-4xl font-semibold">
              GHL blog network dashboard
            </h1>
            <p className="mt-2 text-slate-300">Signed in as {user.email}</p>
          </div>
          <form action={logoutAction}>
            <button className="rounded-full border border-white/20 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
              Log out
            </button>
          </form>
        </header>

        {error ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
            <p className="font-semibold">Generation failed</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Add a network</h2>
            <p className="mt-2 text-sm text-slate-600">
              Save the GHL variables, blog ID, and topic strategy for one
              website.
            </p>

            <form action={createNetworkAction} className="mt-6 space-y-4">
              <TextInput label="Network name" name="name" required />
              <TextInput label="GHL API token" name="apiToken" required />
              <TextInput
                label="GHL blog ID"
                name="blogId"
                placeholder="24-character hex blog site ID"
                required
              />
              <TextInput label="GHL location ID" name="ghlLocationId" />
              <TextInput label="GHL company ID" name="ghlCompanyId" />
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Default topic
                </span>
                <textarea
                  required
                  name="defaultTopic"
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                  placeholder="Example: Addiction recovery resources in Bucks County"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Categories
                </span>
                <textarea
                  name="categories"
                  rows={2}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                  placeholder="SEO, recovery, local guide"
                />
              </label>
              <TextInput
                label="Image style"
                name="imageStyle"
                placeholder="Natural editorial image"
              />

              <fieldset>
                <legend className="text-sm font-medium text-slate-700">
                  Future posting days
                </legend>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {postingDays.map((day) => (
                    <label
                      key={day}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <input type="checkbox" name="postingDays" value={day} />
                      {day}
                    </label>
                  ))}
                </div>
              </fieldset>

              <button className="w-full rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800">
                Save network
              </button>
            </form>
          </section>

          <section className="space-y-6">
            {networks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h2 className="text-2xl font-semibold">
                  Add your first GHL blog network
                </h2>
                <p className="mt-2 text-slate-600">
                  Once a network is saved, you can generate the first Claude
                  draft and publish it from here.
                </p>
              </div>
            ) : (
              networks.map((network) => (
                <article
                  key={network.id}
                  className="rounded-3xl bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
                        {network.status}
                      </p>
                      <h2 className="mt-2 text-3xl font-semibold">
                        {network.name}
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        Blog ID: {network.blogConfig?.blogId ?? "missing"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                      {network.posts.length} recent draft
                      {network.posts.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <h3 className="font-semibold">Generate next blog</h3>
                    <form
                      action={generatePostAction}
                      className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"
                    >
                      <input type="hidden" name="networkId" value={network.id} />
                      <input
                        name="topic"
                        className="rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                        placeholder={
                          network.blogConfig?.defaultTopic ??
                          "Topic for this blog"
                        }
                      />
                      <button className="rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200">
                        Generate draft
                      </button>
                    </form>
                  </div>

                  <div className="mt-6 space-y-4">
                    {network.posts.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
                        No drafts yet for this network.
                      </p>
                    ) : (
                      network.posts.map((post) => (
                        <div
                          key={post.id}
                          className="rounded-2xl border border-slate-200 p-4"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            {post.status}
                          </p>
                          <h3 className="mt-2 text-xl font-semibold">
                            {post.title}
                          </h3>
                          <p className="mt-2 text-sm text-slate-600">
                            {post.excerpt}
                          </p>

                          {post.imageUrl ? (
                            <div
                              aria-label={post.title}
                              className="mt-4 aspect-[16/9] w-full rounded-2xl bg-cover bg-center"
                              role="img"
                              style={{
                                backgroundImage: `url(${post.imageUrl})`,
                              }}
                            />
                          ) : null}

                          {post.errorMessage ? (
                            <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                              {post.errorMessage}
                            </p>
                          ) : null}

                          {post.imagePrompt ? (
                            <p className="mt-3 text-sm text-slate-500">
                              Image prompt: {post.imagePrompt}
                            </p>
                          ) : null}

                          {post.status === "draft" ||
                          post.status === "failed" ? (
                            <details className="mt-4 rounded-2xl bg-slate-50 p-4">
                              <summary className="cursor-pointer font-semibold">
                                Edit draft
                              </summary>
                              <form
                                action={updateDraftAction}
                                className="mt-4 space-y-4"
                              >
                                <input
                                  type="hidden"
                                  name="postId"
                                  value={post.id}
                                />
                                <TextInput
                                  label="Title"
                                  name="title"
                                  required
                                  defaultValue={post.title}
                                />
                                <TextInput
                                  label="URL slug"
                                  name="slug"
                                  required
                                  defaultValue={post.slug}
                                />
                                <label className="block">
                                  <span className="text-sm font-medium text-slate-700">
                                    Excerpt
                                  </span>
                                  <textarea
                                    required
                                    name="excerpt"
                                    rows={3}
                                    defaultValue={post.excerpt}
                                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                                  />
                                </label>
                                <label className="block">
                                  <span className="text-sm font-medium text-slate-700">
                                    Body markdown
                                  </span>
                                  <textarea
                                    required
                                    name="bodyMarkdown"
                                    rows={10}
                                    defaultValue={post.bodyMarkdown}
                                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                                  />
                                </label>
                                <TextInput
                                  label="Categories"
                                  name="categories"
                                  defaultValue={post.categories.join(", ")}
                                />
                                <TextInput
                                  label="Image URL"
                                  name="imageUrl"
                                  defaultValue={post.imageUrl ?? ""}
                                  placeholder="https://example.com/image.jpg"
                                />
                                <label className="block">
                                  <span className="text-sm font-medium text-slate-700">
                                    Image prompt
                                  </span>
                                  <textarea
                                    name="imagePrompt"
                                    rows={3}
                                    defaultValue={post.imagePrompt ?? ""}
                                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
                                  />
                                </label>
                                <button className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
                                  Save draft
                                </button>
                              </form>
                            </details>
                          ) : null}

                          <div className="mt-4 flex flex-wrap gap-3">
                            {post.status === "draft" ||
                            post.status === "failed" ? (
                              <form action={publishPostAction}>
                                <input
                                  type="hidden"
                                  name="postId"
                                  value={post.id}
                                />
                                <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">
                                  Publish
                                </button>
                              </form>
                            ) : null}

                            <form action={deletePostAction}>
                              <input
                                type="hidden"
                                name="postId"
                                value={post.id}
                              />
                              <button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                                Delete
                              </button>
                            </form>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function TextInput({
  label,
  name,
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        required={required}
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2"
        placeholder={placeholder}
      />
    </label>
  );
}
