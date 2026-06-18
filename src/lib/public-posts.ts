import type { BlogPost, BlogConfig, Network } from "@prisma/client";

import { markdownToHtml } from "@/lib/content";

type SiteWithConfig = Network & {
  blogConfig: BlogConfig | null;
};

type PublicPost = BlogPost & {
  network: SiteWithConfig;
};

export function publicSitePayload(site: SiteWithConfig) {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    domain: site.domain,
    locationName: site.locationName,
    city: site.city,
    state: site.state,
    serviceArea: site.serviceArea,
    author: {
      name: site.authorName,
      title: site.authorTitle,
      bio: site.authorBio,
      imageUrl: site.authorImageUrl,
    },
    categories: site.blogConfig?.categories ?? [],
  };
}

export function publicPostPayload(post: PublicPost) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    bodyMarkdown: post.bodyMarkdown,
    bodyHtml: post.bodyHtml || markdownToHtml(post.bodyMarkdown),
    categories: post.categories,
    source: post.source,
    scheduledFor: post.scheduledFor?.toISOString() ?? null,
    seo: {
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      canonicalUrl: post.canonicalUrl,
    },
    featuredImage: {
      url: post.imageUrl,
      alt: post.featuredImageAlt || post.title,
      prompt: post.imagePrompt,
      provider: post.imageProvider,
      credit: post.imageCredit,
      sourceUrl: post.imageSourceUrl,
    },
    publishedAt: post.publishedAt?.toISOString() ?? null,
    updatedAt: post.updatedAt.toISOString(),
    site: publicSitePayload(post.network),
  };
}
