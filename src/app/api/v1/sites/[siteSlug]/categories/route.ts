import { prisma } from "@/lib/db";
import { publicSitePayload } from "@/lib/public-posts";

type RouteContext = {
  params: Promise<{
    siteSlug: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { siteSlug } = await params;
  const site = await prisma.network.findFirst({
    where: {
      slug: siteSlug,
      status: "active",
    },
    include: {
      blogConfig: true,
    },
  });

  if (!site) {
    return Response.json(
      { error: "Site not found." },
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
      site: publicSitePayload(site),
      categories: site.blogConfig?.categories ?? [],
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
