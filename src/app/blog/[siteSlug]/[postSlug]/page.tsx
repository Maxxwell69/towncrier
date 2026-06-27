import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";

export const revalidate = 60;

type Props = {
  params: Promise<{ siteSlug: string; postSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { siteSlug, postSlug } = await params;
  const post = await getPost(siteSlug, postSlug);
  if (!post) return {};
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt,
    openGraph: {
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt,
      images: post.imageUrl ? [{ url: post.imageUrl }] : [],
    },
  };
}

async function getPost(siteSlug: string, postSlug: string) {
  return prisma.blogPost.findFirst({
    where: {
      slug: postSlug,
      status: "published",
      network: { slug: siteSlug, status: "active" },
    },
    include: {
      network: {
        select: {
          name: true,
          slug: true,
          domain: true,
          authorName: true,
          authorTitle: true,
          authorBio: true,
          authorImageUrl: true,
        },
      },
    },
  });
}

export default async function PostPage({ params }: Props) {
  const { siteSlug, postSlug } = await params;
  const post = await getPost(siteSlug, postSlug);

  if (!post) notFound();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://towncrier-production.up.railway.app";

  const relatedPosts = await prisma.blogPost.findMany({
    where: {
      id: { not: post.id },
      status: "published",
      network: { slug: siteSlug, status: "active" },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      imageUrl: true,
      publishedAt: true,
      categories: true,
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4 text-sm">
          <Link href="/" className="font-bold text-slate-900">
            Twncrier
          </Link>
          <span className="text-slate-300">/</span>
          <Link href="/blog" className="text-slate-600 hover:text-slate-900">
            Content Hub
          </Link>
          <span className="text-slate-300">/</span>
          <Link
            href={`/blog?author=${siteSlug}`}
            className="text-slate-600 hover:text-slate-900"
          >
            {post.network.authorName ?? post.network.name}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        {/* Categories */}
        {post.categories.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {post.categories.map((c) => (
              <Link
                key={c}
                href={`/blog?category=${encodeURIComponent(c)}`}
                className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-100"
              >
                {c}
              </Link>
            ))}
          </div>
        ) : null}

        <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
          {post.title}
        </h1>

        <p className="mt-4 text-lg text-slate-600">{post.excerpt}</p>

        {/* Author + meta row */}
        <div className="mt-6 flex flex-wrap items-center gap-4 border-y border-slate-200 py-4">
          <div className="flex items-center gap-3">
            {post.network.authorImageUrl ? (
              <img
                src={post.network.authorImageUrl}
                alt={post.network.authorName ?? post.network.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-500">
                {(post.network.authorName ?? post.network.name).charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-900">
                {post.network.authorName ?? post.network.name}
              </p>
              {post.network.authorTitle ? (
                <p className="text-xs text-slate-500">{post.network.authorTitle}</p>
              ) : null}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4 text-sm text-slate-500">
            {post.publishedAt ? (
              <time dateTime={post.publishedAt.toISOString()}>
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            ) : null}

            {/* RSS for this author */}
            <a
              href={`/blog/${siteSlug}/feed.xml`}
              title="RSS feed for this author"
              className="flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-100"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3.75 3a.75.75 0 00-.75.75v.5c0 .414.336.75.75.75H4c6.075 0 11 4.925 11 11v.25c0 .414.336.75.75.75h.5a.75.75 0 00.75-.75V16C17 8.82 11.18 3 4 3h-.25z" />
                <path d="M3 8.75A.75.75 0 013.75 8H4a8 8 0 018 8v.25a.75.75 0 01-.75.75h-.5a.75.75 0 01-.75-.75V16a6 6 0 00-6-6h-.25A.75.75 0 013 9.25v-.5zM7 15a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              RSS
            </a>
          </div>
        </div>

        {/* Featured image */}
        {post.imageUrl ? (
          <figure className="mt-8 overflow-hidden rounded-3xl">
            <img
              src={post.imageUrl}
              alt={post.featuredImageAlt ?? post.title}
              className="w-full object-cover"
            />
            {post.imageCredit ? (
              <figcaption className="mt-2 text-center text-xs text-slate-400">
                Photo by {post.imageCredit}
                {post.imageSourceUrl ? (
                  <>
                    {" "}
                    on{" "}
                    <a
                      href={post.imageSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Pexels
                    </a>
                  </>
                ) : null}
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        {/* Body */}
        <article
          className="prose prose-slate mt-10 max-w-none prose-headings:font-bold prose-a:text-cyan-700"
          dangerouslySetInnerHTML={{
            __html: post.bodyHtml ?? post.bodyMarkdown,
          }}
        />

        {/* Author bio */}
        {post.network.authorBio ? (
          <div className="mt-12 rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              {post.network.authorImageUrl ? (
                <img
                  src={post.network.authorImageUrl}
                  alt={post.network.authorName ?? post.network.name}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : null}
              <div>
                <p className="font-semibold text-slate-900">
                  {post.network.authorName ?? post.network.name}
                </p>
                {post.network.authorTitle ? (
                  <p className="text-sm text-slate-500">{post.network.authorTitle}</p>
                ) : null}
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">{post.network.authorBio}</p>
            {post.network.domain ? (
              <a
                href={`https://${post.network.domain.replace(/^https?:\/\//, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-cyan-700 underline"
              >
                Visit {post.network.domain.replace(/^https?:\/\//, "")} →
              </a>
            ) : null}
          </div>
        ) : null}

        {/* Related posts */}
        {relatedPosts.length > 0 ? (
          <section className="mt-12">
            <h2 className="mb-5 text-xl font-bold text-slate-900">
              More from {post.network.authorName ?? post.network.name}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {relatedPosts.map((r) => (
                <Link
                  key={r.id}
                  href={`/blog/${siteSlug}/${r.slug}`}
                  className="group rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  {r.imageUrl ? (
                    <img
                      src={r.imageUrl}
                      alt={r.title}
                      className="mb-3 h-32 w-full rounded-xl object-cover"
                    />
                  ) : null}
                  <h3 className="text-sm font-semibold leading-snug text-slate-900 group-hover:text-cyan-700">
                    {r.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{r.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-10 border-t border-slate-200 pt-6">
          <Link
            href="/blog"
            className="text-sm font-medium text-cyan-700 hover:text-cyan-600"
          >
            ← Back to Content Hub
          </Link>
        </div>
      </main>
    </div>
  );
}
