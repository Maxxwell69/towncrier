import { prisma } from "@/lib/db";
import { publicPostPayload } from "@/lib/public-posts";

type RouteContext = {
  params: Promise<{
    siteSlug: string;
    postSlug: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { siteSlug, postSlug } = await params;
  const post = await prisma.blogPost.findFirst({
    where: {
      slug: postSlug,
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
  });

  if (!post) {
    return Response.json(
      { error: "Post not found." },
      {
        status: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  return Response.json(
    {
      post: publicPostPayload(post),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
