import Link from "next/link";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    author?: string;
    category?: string;
    page?: string;
  }>;
};

const PER_PAGE = 12;

export default async function BlogHubPage({ searchParams }: Props) {
  const { author, category, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1));
  const skip = (page - 1) * PER_PAGE;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://towncrier-production.up.railway.app";

  const where = {
    status: "published" as const,
    network: {
      status: "active" as const,
      ...(author ? { slug: author } : {}),
    },
    ...(category ? { categories: { has: category } } : {}),
  };

  const [posts, total, networks, allCategories] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      include: {
        network: {
          select: {
            name: true,
            slug: true,
            authorName: true,
            authorTitle: true,
            authorImageUrl: true,
            domain: true,
          },
        },
      },
      orderBy: { publishedAt: "desc" },
      take: PER_PAGE,
      skip,
    }),
    prisma.blogPost.count({ where }),
    prisma.network.findMany({
      where: { status: "active" },
      select: { name: true, slug: true, authorName: true },
      orderBy: { name: "asc" },
    }),
    prisma.blogPost.findMany({
      where: { status: "published", network: { status: "active" } },
      select: { categories: true },
    }),
  ]);

  const categorySet = new Set<string>();
  for (const p of allCategories) {
    for (const c of p.categories) {
      if (c) categorySet.add(c);
    }
  }
  const categories = [...categorySet].sort();

  const totalPages = Math.ceil(total / PER_PAGE);

  const buildUrl = (params: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { author, category, ...params };
    for (const [k, v] of Object.entries(merged)) {
      if (v) q.set(k, v);
    }
    const qs = q.toString();
    return `/blog${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
              Twncrier
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-700">Content Hub</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/feed.xml"
              title="Global RSS feed"
              className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25z" />
                <path d="M3 8.75A.75.75 0 013.75 8H4a8 8 0 018 8v.25a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V16a6 6 0 00-6-6h-.25A.75.75 0 013 9.25v-.5zM7 15a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              RSS
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Content Hub</h1>
          <p className="mt-2 text-slate-600">
            Articles and insights from all our authors.{" "}
            <span className="font-medium">{total}</span> published posts.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* Sidebar filters */}
          <aside className="space-y-6">
            {/* Authors */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
                Authors
              </h2>
              <ul className="space-y-1">
                <li>
                  <Link
                    href={buildUrl({ author: undefined, page: undefined })}
                    className={`block rounded-xl px-3 py-2 text-sm transition ${
                      !author
                        ? "bg-slate-950 font-semibold text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    All authors
                  </Link>
                </li>
                {networks.map((n) => (
                  <li key={n.slug}>
                    <Link
                      href={buildUrl({ author: n.slug, page: undefined })}
                      className={`block rounded-xl px-3 py-2 text-sm transition ${
                        author === n.slug
                          ? "bg-slate-950 font-semibold text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {n.authorName ?? n.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Categories */}
            {categories.length > 0 ? (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-500">
                  Categories
                </h2>
                <ul className="space-y-1">
                  <li>
                    <Link
                      href={buildUrl({ category: undefined, page: undefined })}
                      className={`block rounded-xl px-3 py-2 text-sm transition ${
                        !category
                          ? "bg-cyan-500 font-semibold text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      All topics
                    </Link>
                  </li>
                  {categories.map((c) => (
                    <li key={c}>
                      <Link
                        href={buildUrl({ category: c, page: undefined })}
                        className={`block rounded-xl px-3 py-2 text-sm transition ${
                          category === c
                            ? "bg-cyan-500 font-semibold text-white"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {c}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* RSS links */}
            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-orange-700">
                RSS Feeds
              </h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="/feed.xml"
                    className="flex items-center gap-2 text-orange-800 underline hover:text-orange-600"
                  >
                    All content
                  </a>
                </li>
                {networks.map((n) => (
                  <li key={n.slug}>
                    <a
                      href={`/blog/${n.slug}/feed.xml`}
                      className="flex items-center gap-2 text-orange-800 underline hover:text-orange-600"
                    >
                      {n.authorName ?? n.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Post grid */}
          <main>
            {posts.length === 0 ? (
              <div className="flex h-64 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white text-slate-500">
                No posts found for this filter.
              </div>
            ) : (
              <>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {posts.map((post) => (
                    <article
                      key={post.id}
                      className="group flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm transition hover:shadow-md"
                    >
                      {post.imageUrl ? (
                        <Link
                          href={`/blog/${post.network.slug}/${post.slug}`}
                          className="block aspect-[16/9] overflow-hidden bg-slate-100"
                        >
                          <img
                            src={post.imageUrl}
                            alt={post.featuredImageAlt ?? post.title}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        </Link>
                      ) : null}

                      <div className="flex flex-1 flex-col p-5">
                        {/* Categories */}
                        {post.categories.length > 0 ? (
                          <div className="mb-2 flex flex-wrap gap-1">
                            {post.categories.slice(0, 3).map((c) => (
                              <Link
                                key={c}
                                href={buildUrl({ category: c, page: undefined })}
                                className="rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100"
                              >
                                {c}
                              </Link>
                            ))}
                          </div>
                        ) : null}

                        <Link href={`/blog/${post.network.slug}/${post.slug}`}>
                          <h2 className="text-lg font-semibold leading-snug text-slate-900 group-hover:text-cyan-700">
                            {post.title}
                          </h2>
                        </Link>

                        <p className="mt-2 flex-1 text-sm text-slate-600 line-clamp-3">
                          {post.excerpt}
                        </p>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                          <div className="flex items-center gap-2">
                            {post.network.authorImageUrl ? (
                              <img
                                src={post.network.authorImageUrl}
                                alt={post.network.authorName ?? post.network.name}
                                className="h-6 w-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-500">
                                {(post.network.authorName ?? post.network.name)
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                            <Link
                              href={buildUrl({
                                author: post.network.slug,
                                page: undefined,
                              })}
                              className="text-xs font-medium text-slate-600 hover:text-slate-900"
                            >
                              {post.network.authorName ?? post.network.name}
                            </Link>
                          </div>
                          <time className="text-xs text-slate-400">
                            {post.publishedAt
                              ? new Date(post.publishedAt).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric", year: "numeric" },
                                )
                              : ""}
                          </time>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 ? (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    {page > 1 ? (
                      <Link
                        href={buildUrl({ page: String(page - 1) })}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        ← Previous
                      </Link>
                    ) : null}
                    <span className="text-sm text-slate-500">
                      Page {page} of {totalPages}
                    </span>
                    {page < totalPages ? (
                      <Link
                        href={buildUrl({ page: String(page + 1) })}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Next →
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
