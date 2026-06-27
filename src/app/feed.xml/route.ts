import { prisma } from "@/lib/db";
import { buildRssFeed, rssResponse } from "@/lib/rss";

export const revalidate = 300;

export async function GET() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://towncrier-production.up.railway.app";

  const posts = await prisma.blogPost.findMany({
    where: {
      status: "published",
      network: { status: "active" },
    },
    include: {
      network: {
        select: {
          name: true,
          slug: true,
          authorName: true,
        },
      },
    },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });

  const xml = buildRssFeed({
    title: "Twncrier Content Hub",
    siteUrl: `${appUrl}/blog`,
    feedUrl: `${appUrl}/feed.xml`,
    description:
      "The latest articles and insights from all Twncrier authors.",
    items: posts.map((post) => ({
      title: post.title,
      link: `${appUrl}/blog/${post.network.slug}/${post.slug}`,
      guid: `${appUrl}/blog/${post.network.slug}/${post.slug}`,
      description: post.excerpt,
      pubDate: (post.publishedAt ?? post.createdAt).toUTCString(),
      author: post.network.authorName ?? post.network.name,
      categories: post.categories,
      imageUrl: post.imageUrl ?? undefined,
    })),
  });

  return rssResponse(xml);
}
