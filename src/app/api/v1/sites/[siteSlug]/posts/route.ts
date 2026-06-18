import { prisma } from "@/lib/db";
import { publicPostPayload } from "@/lib/public-posts";

type RouteContext = {
  params: Promise<{
    siteSlug: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { siteSlug } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const posts = await prisma.blogPost.findMany({
    where: {
      status: "published",
      network: {
        slug: siteSlug,
        status: "active",
      },
    },
    include: {
      network: {
        include: {
          blogConfig: true,
        },
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: limit,
  });

  return Response.json(
    {
      posts: posts.map(publicPostPayload),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
