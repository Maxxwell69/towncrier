import { prisma } from "@/lib/db";
import { buildRssFeed, rssResponse } from "@/lib/rss";

export const revalidate = 300;

type RouteContext = { params: Promise<{ siteSlug: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { siteSlug } = await params;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://towncrier-production.up.railway.app";

  const network = await prisma.network.findFirst({
    where: { slug: siteSlug, status: "active" },
    select: { name: true, slug: true, authorName: true, authorTitle: true },
  });

  if (!network) {
    return new Response("Not found", { status: 404 });
  }

  const posts = await prisma.blogPost.findMany({
    where: {
      status: "published",
      network: { slug: siteSlug, status: "active" },
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const authorLabel = network.authorName ?? network.name;

  const xml = buildRssFeed({
    title: `${authorLabel} — Twncrier`,
    siteUrl: `${appUrl}/blog?author=${siteSlug}`,
    feedUrl: `${appUrl}/blog/${siteSlug}/feed.xml`,
    description: `The latest articles from ${authorLabel}.`,
    items: posts.map((post) => ({
      title: post.title,
      link: `${appUrl}/blog/${siteSlug}/${post.slug}`,
      guid: `${appUrl}/blog/${siteSlug}/${post.slug}`,
      description: post.excerpt,
      pubDate: (post.publishedAt ?? post.createdAt).toUTCString(),
      author: authorLabel,
      categories: post.categories,
      imageUrl: post.imageUrl ?? undefined,
    })),
  });

  return rssResponse(xml);
}
