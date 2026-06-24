/**
 * Core automation logic shared between the dashboard server actions and the
 * scheduled cron endpoint. All functions here work without a signed-in user
 * context so they can be called from /api/cron/run.
 */

import { generateBlogDraft } from "@/lib/claude";
import { markdownToHtml, slugify } from "@/lib/content";
import { prisma } from "@/lib/db";
import { publishBlogPost } from "@/lib/ghl";
import { searchPexelsImages } from "@/lib/pexels";

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function todayDayName() {
  return DAY_NAMES[new Date().getDay()];
}

async function uniquePostSlug(networkId: string, raw: string) {
  const base = slugify(raw);
  const existing = await prisma.blogPost.findMany({
    where: {
      networkId,
      slug: { startsWith: base },
    },
    select: { slug: true },
  });

  if (!existing.some((p) => p.slug === base)) {
    return base;
  }

  let i = 2;
  while (existing.some((p) => p.slug === `${base}-${i}`)) {
    i++;
  }

  return `${base}-${i}`;
}

async function attachPexelsImage(postId: string, query: string, alt: string) {
  try {
    const candidates = await searchPexelsImages(query);

    if (candidates.length === 0) {
      return;
    }

    const best = candidates[0];

    await prisma.imageCandidate.createMany({
      data: candidates.map((c) => ({
        postId,
        provider: "pexels" as const,
        imageUrl: c.imageUrl,
        photographer: c.photographer ?? null,
        photographerUrl: c.photographerUrl ?? null,
        sourceUrl: c.sourceUrl ?? null,
        altText: c.altText ?? alt,
      })),
      skipDuplicates: true,
    });

    await prisma.blogPost.update({
      where: { id: postId },
      data: {
        imageUrl: best.imageUrl,
        imageProvider: "pexels",
        imageCredit: best.photographer ?? null,
        imageSourceUrl: best.sourceUrl ?? null,
        featuredImageAlt: best.altText ?? alt,
      },
    });
  } catch {
    // Image is non-critical — log and continue.
    console.warn(`[automation] Pexels image fetch failed for post ${postId}`);
  }
}

export type AutomationNetwork = {
  id: string;
  name: string;
  domain: string | null;
  locationName: string | null;
  city: string | null;
  state: string | null;
  serviceArea: string | null;
  authorName: string | null;
  authorTitle: string | null;
  platform: string;
  ghlLocationId: string | null;
  encryptedCredentialPayload: string | null;
  revalidateUrl: string | null;
  revalidateSecret: string | null;
  blogConfig: {
    blogId: string | null;
    defaultTopic: string;
    categories: string[];
    postingDays: string[];
    postingTime: string;
    imageStyle: string | null;
    automationEnabled: boolean;
    autoPublishEnabled: boolean;
    autoImageEnabled: boolean;
    lastAutoRunDate: Date | null;
  } | null;
};

export type RunResult = {
  networkId: string;
  networkName: string;
  skipped?: string;
  postId?: string;
  postTitle?: string;
  published?: boolean;
  error?: string;
};

/**
 * Find all active networks that have automation enabled and whose postingDays
 * list includes today (or have no restriction if the list is empty).
 */
export async function getNetworksScheduledForToday(): Promise<
  AutomationNetwork[]
> {
  const networks = await prisma.network.findMany({
    where: {
      status: "active",
      blogConfig: {
        automationEnabled: true,
      },
    },
    include: { blogConfig: true },
  });

  const today = todayDayName();

  return networks.filter((n) => {
    const days = n.blogConfig?.postingDays ?? [];
    // If no days are configured, run every day.
    return days.length === 0 || days.map((d) => d.toLowerCase()).includes(today);
  });
}

/**
 * Run one generation + optional publish cycle for a single network.
 * Returns a result summary; never throws.
 */
export async function runAutomationForNetwork(
  network: AutomationNetwork,
): Promise<RunResult> {
  const base: Pick<RunResult, "networkId" | "networkName"> = {
    networkId: network.id,
    networkName: network.name,
  };

  if (!network.blogConfig) {
    return { ...base, skipped: "missing blog config" };
  }

  const topic = await prisma.topic.findFirst({
    where: {
      networkId: network.id,
      isActive: true,
    },
    orderBy: [{ useCount: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
  });

  if (!topic) {
    return { ...base, skipped: "no active topics" };
  }

  const topicText = [topic.title, topic.description].filter(Boolean).join("\n\n");

  const existingDraft = await prisma.blogPost.findFirst({
    where: {
      networkId: network.id,
      topic: { equals: topicText, mode: "insensitive" },
      status: { in: ["draft", "failed"] },
    },
  });

  if (existingDraft) {
    return {
      ...base,
      skipped: `existing draft already exists for topic "${topic.title}"`,
    };
  }

  try {
    const draft = await generateBlogDraft({
      networkName: network.name,
      domain: network.domain,
      locationName: network.locationName,
      city: network.city,
      state: network.state,
      serviceArea: network.serviceArea,
      authorName: network.authorName,
      authorTitle: network.authorTitle,
      topic: topicText,
      categories: network.blogConfig.categories,
      imageStyle: network.blogConfig.imageStyle,
    });

    const postSlug = await uniquePostSlug(
      network.id,
      draft.slug || draft.title,
    );
    const bodyHtml = markdownToHtml(draft.bodyMarkdown);

    const post = await prisma.blogPost.create({
      data: {
        networkId: network.id,
        topicId: topic.id,
        topic: topicText,
        title: draft.title,
        slug: postSlug,
        excerpt: draft.excerpt,
        bodyMarkdown: draft.bodyMarkdown,
        bodyHtml,
        categories: draft.categories,
        seoTitle: draft.title,
        seoDescription: draft.excerpt,
        imagePrompt: draft.imagePrompt,
        featuredImageAlt: draft.title,
        source: "topic_queue",
      },
    });

    await prisma.topic.update({
      where: { id: topic.id },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    });

    if (network.blogConfig.autoImageEnabled) {
      await attachPexelsImage(
        post.id,
        draft.imagePrompt || topicText || draft.title,
        draft.title,
      );
    }

    if (!network.blogConfig.autoPublishEnabled) {
      return { ...base, postId: post.id, postTitle: draft.title, published: false };
    }

    // Fetch the saved image URL (may have been updated by Pexels step above)
    const savedPost = await prisma.blogPost.findUniqueOrThrow({
      where: { id: post.id },
      select: { imageUrl: true },
    });

    await prisma.blogPost.update({
      where: { id: post.id },
      data: { status: "publishing", errorMessage: null },
    });

    try {
      if (network.platform === "ghl") {
        if (!network.blogConfig.blogId) {
          throw new Error("GHL blog ID is required for GHL publishing.");
        }

        const result = await publishBlogPost({
          blogId: network.blogConfig.blogId,
          locationId: network.ghlLocationId,
          encryptedCredentialPayload: network.encryptedCredentialPayload,
          title: draft.title,
          slug: postSlug,
          excerpt: draft.excerpt,
          bodyMarkdown: draft.bodyMarkdown,
          categories: draft.categories,
          imageUrl: savedPost.imageUrl,
        });

        await prisma.blogPost.update({
          where: { id: post.id },
          data: {
            status: "published",
            ghlPostId: result.externalId,
            externalPostId: result.externalId,
            publishedTo: "ghl",
            publishedAt: new Date(),
          },
        });
      } else {
        // Vercel / default
        const revalidateUrl = network.revalidateUrl;
        const revalidateSecret = network.revalidateSecret;

        if (revalidateUrl) {
          await fetch(revalidateUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(revalidateSecret
                ? { "x-revalidate-secret": revalidateSecret }
                : {}),
            },
            body: JSON.stringify({ paths: [`/blog`, `/blog/${postSlug}`] }),
          }).catch((e) =>
            console.warn("[automation] Revalidate failed:", e.message),
          );
        }

        await prisma.blogPost.update({
          where: { id: post.id },
          data: {
            status: "published",
            externalPostId: post.id,
            publishedTo: "towncrier",
            publishedAt: new Date(),
          },
        });
      }

      return { ...base, postId: post.id, postTitle: draft.title, published: true };
    } catch (publishError) {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: {
          status: "failed",
          errorMessage:
            publishError instanceof Error
              ? publishError.message
              : "Unknown publish error",
        },
      });

      return {
        ...base,
        postId: post.id,
        postTitle: draft.title,
        published: false,
        error: publishError instanceof Error ? publishError.message : "Publish failed",
      };
    }
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Unknown error during generation",
    };
  }
}
