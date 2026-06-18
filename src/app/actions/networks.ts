"use server";

import type { BlogConfig, BlogPost, Network, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { generateBlogDraft } from "@/lib/claude";
import {
  apiKeyHint,
  hashApiKey,
  markdownToHtml,
  slugify,
} from "@/lib/content";
import { encryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { publishBlogPost } from "@/lib/ghl";
import { searchPexelsImages } from "@/lib/pexels";

const networkSchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  domain: z.string().optional(),
  platform: z.enum(["vercel", "ghl", "wordpress"]).default("vercel"),
  locationName: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  serviceArea: z.string().optional(),
  authorName: z.string().optional(),
  authorTitle: z.string().optional(),
  authorBio: z.string().optional(),
  authorImageUrl: z.string().url().optional().or(z.literal("")),
  siteApiKey: z.string().optional(),
  revalidateUrl: z.string().url().optional().or(z.literal("")),
  revalidateSecret: z.string().optional(),
  ghlLocationId: z.string().optional(),
  ghlCompanyId: z.string().optional(),
  apiToken: z.string().optional(),
  blogId: z.string().optional(),
  defaultTopic: z.string().min(5),
  categories: z.string().optional(),
  postingDays: z.array(z.string()).default([]),
  imageStyle: z.string().optional(),
  automationEnabled: z.boolean().default(false),
  autoPublishEnabled: z.boolean().default(false),
  autoImageEnabled: z.boolean().default(true),
});

const updateNetworkSchema = networkSchema.extend({
  networkId: z.string().min(1),
  apiToken: z.string().optional(),
});

const generateSchema = z.object({
  networkId: z.string().min(1),
  topic: z.string().optional(),
});

const topicSchema = z.object({
  networkId: z.string().min(1),
  title: z.string().min(3),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.coerce.number().int().default(0),
});

const topicIdSchema = z.object({
  topicId: z.string().min(1),
});

const publishSchema = z.object({
  postId: z.string().min(1),
});

const postIdSchema = z.object({
  postId: z.string().min(1),
});

const updateDraftSchema = z.object({
  postId: z.string().min(1),
  title: z.string().min(5),
  slug: z.string().min(3),
  excerpt: z.string().min(20),
  bodyMarkdown: z.string().min(200),
  categories: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  canonicalUrl: z.string().url().optional().or(z.literal("")),
  imagePrompt: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  featuredImageAlt: z.string().optional(),
});

const manualPostSchema = z.object({
  networkId: z.string().min(1),
  title: z.string().min(5),
  slug: z.string().optional(),
  excerpt: z.string().min(20),
  bodyMarkdown: z.string().min(200),
  categories: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  canonicalUrl: z.string().url().optional().or(z.literal("")),
  imagePrompt: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  featuredImageAlt: z.string().optional(),
  scheduledFor: z.string().optional(),
});

const imageCandidateSchema = z.object({
  candidateId: z.string().min(1),
});

function listFromText(value?: string) {
  return (value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = typeof value === "string" ? value.trim() : "";
  return stringValue || undefined;
}

function checkboxValue(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function dashboardError(message: string): never {
  redirect(`/dashboard?error=${encodeURIComponent(message)}`);
}

async function uniquePostSlug(networkId: string, rawSlug: string, postId?: string) {
  const baseSlug = slugify(rawSlug) || "blog-post";
  let candidate = baseSlug;
  let suffix = 2;

  while (
    await prisma.blogPost.findFirst({
      where: {
        networkId,
        slug: candidate,
        ...(postId ? { NOT: { id: postId } } : {}),
      },
      select: { id: true },
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function revalidateVercelSite(input: {
  revalidateUrl?: string | null;
  revalidateSecret?: string | null;
  slug: string;
}) {
  if (!input.revalidateUrl) {
    return { skipped: true, reason: "No revalidation URL configured." };
  }

  const response = await fetch(input.revalidateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.revalidateSecret
        ? { Authorization: `Bearer ${input.revalidateSecret}` }
        : {}),
    },
    body: JSON.stringify({
      path: `/blog/${input.slug}`,
      paths: ["/blog", `/blog/${input.slug}`],
      slug: input.slug,
    }),
  });
  const text = await response.text();

  return {
    skipped: false,
    ok: response.ok,
    status: response.status,
    body: text,
  };
}

async function revalidatePublishedPost(post: {
  slug: string;
  status: string;
  network?: {
    platform: string;
    revalidateUrl?: string | null;
    revalidateSecret?: string | null;
  };
}) {
  if (post.status !== "published" || post.network?.platform === "ghl") {
    return;
  }

  await revalidateVercelSite({
    revalidateUrl: post.network?.revalidateUrl,
    revalidateSecret: post.network?.revalidateSecret,
    slug: post.slug,
  });
}

type PublishablePost = BlogPost & {
  network: Network & {
    blogConfig: BlogConfig | null;
  };
};

async function getOwnedPostForPublish(postId: string, ownerId: string) {
  return prisma.blogPost.findFirst({
    where: {
      id: postId,
      network: {
        ownerId,
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
}

async function publishPostRecord(post: PublishablePost) {
  if (!post.network.blogConfig) {
    throw new Error("Post not found or missing blog configuration.");
  }

  const bodyHtml = post.bodyHtml || markdownToHtml(post.bodyMarkdown);

  await prisma.blogPost.update({
    where: { id: post.id },
    data: {
      status: "publishing",
      errorMessage: null,
    },
  });

  try {
    if (post.network.platform === "ghl") {
      if (!post.network.blogConfig.blogId) {
        throw new Error("GHL blog ID is required for GHL publishing.");
      }

      const result = await publishBlogPost({
        blogId: post.network.blogConfig.blogId,
        locationId: post.network.ghlLocationId,
        encryptedCredentialPayload: post.network.encryptedCredentialPayload,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        bodyMarkdown: post.bodyMarkdown,
        categories: post.categories,
        imageUrl: post.imageUrl,
      });

      await prisma.blogPost.update({
        where: { id: post.id },
        data: {
          bodyHtml,
          status: "published",
          ghlPostId: result.externalId,
          externalPostId: result.externalId,
          publishedTo: "ghl",
          publishResponse: result.response as Prisma.InputJsonValue,
          publishedAt: new Date(),
        },
      });

      return;
    }

    const revalidateResult = await revalidateVercelSite({
      revalidateUrl: post.network.revalidateUrl,
      revalidateSecret: post.network.revalidateSecret,
      slug: post.slug,
    });

    await prisma.blogPost.update({
      where: { id: post.id },
      data: {
        bodyHtml,
        status: "published",
        externalPostId: post.id,
        publishedTo: "towncrier",
        publishResponse: {
          platform: "vercel",
          revalidate: revalidateResult,
        } as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });
  } catch (error) {
    await prisma.blogPost.update({
      where: { id: post.id },
      data: {
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Unknown publish error.",
      },
    });
  }
}

async function getOwnedNetwork(networkId: string, ownerId: string) {
  return prisma.network.findFirst({
    where: {
      id: networkId,
      ownerId,
    },
    include: {
      blogConfig: true,
    },
  });
}

async function attachAutomaticPexelsImage(input: {
  postId: string;
  query: string;
  fallbackAlt: string;
}) {
  try {
    const candidates = await searchPexelsImages(input.query);
    const usableCandidates = candidates.filter((candidate) => candidate.imageUrl);
    const selected = usableCandidates[0];

    if (!selected) {
      return;
    }

    await prisma.$transaction([
      prisma.imageCandidate.deleteMany({
        where: { postId: input.postId },
      }),
      prisma.imageCandidate.createMany({
        data: usableCandidates.map((candidate) => ({
          postId: input.postId,
          imageUrl: candidate.imageUrl,
          photographer: candidate.photographer,
          photographerUrl: candidate.photographerUrl,
          sourceUrl: candidate.sourceUrl,
          altText: candidate.altText,
        })),
      }),
      prisma.blogPost.update({
        where: { id: input.postId },
        data: {
          imageUrl: selected.imageUrl,
          featuredImageAlt: selected.altText || input.fallbackAlt,
          imageProvider: "pexels",
          imageCredit: selected.photographer
            ? `Photo by ${selected.photographer} on Pexels`
            : "Photo from Pexels",
          imageSourceUrl: selected.sourceUrl,
        },
      }),
    ]);
  } catch (error) {
    console.warn("Automatic Pexels image search skipped", error);
  }
}

async function createDraftFromClaude(input: {
  network: NonNullable<Awaited<ReturnType<typeof getOwnedNetwork>>>;
  topic: string;
  source: "claude" | "topic_queue";
  topicId?: string;
}) {
  if (!input.network.blogConfig) {
    dashboardError("Site profile is missing blog configuration.");
  }

  const existingDraft = await prisma.blogPost.findFirst({
    where: {
      networkId: input.network.id,
      topic: {
        equals: input.topic,
        mode: "insensitive",
      },
      status: {
        in: ["draft", "failed"],
      },
    },
  });

  if (existingDraft) {
    dashboardError(
      "A draft already exists for that topic. Edit, publish, or delete it before generating another.",
    );
  }

  const draft = await generateBlogDraft({
    networkName: input.network.name,
    domain: input.network.domain,
    locationName: input.network.locationName,
    city: input.network.city,
    state: input.network.state,
    serviceArea: input.network.serviceArea,
    authorName: input.network.authorName,
    authorTitle: input.network.authorTitle,
    topic: input.topic,
    categories: input.network.blogConfig.categories,
    imageStyle: input.network.blogConfig.imageStyle,
  });
  const postSlug = await uniquePostSlug(
    input.network.id,
    draft.slug || draft.title,
  );
  const bodyHtml = markdownToHtml(draft.bodyMarkdown);

  const post = await prisma.blogPost.create({
    data: {
      networkId: input.network.id,
      topicId: input.topicId,
      topic: input.topic,
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
      source: input.source,
    },
  });

  if (input.network.blogConfig.autoImageEnabled) {
    await attachAutomaticPexelsImage({
      postId: post.id,
      query: draft.imagePrompt || input.topic || draft.title,
      fallbackAlt: draft.title,
    });
  }

  return post;
}

async function maybeAutoPublishGeneratedPost(input: {
  postId: string;
  network: NonNullable<Awaited<ReturnType<typeof getOwnedNetwork>>>;
  ownerId: string;
}) {
  if (
    !input.network.blogConfig?.automationEnabled ||
    !input.network.blogConfig.autoPublishEnabled
  ) {
    return;
  }

  const post = await getOwnedPostForPublish(input.postId, input.ownerId);

  if (post) {
    await publishPostRecord(post);
  }
}

export async function createNetworkAction(formData: FormData) {
  const user = await requireUser();
  const parsed = networkSchema.parse({
    name: formData.get("name"),
    slug: optionalString(formData.get("slug")),
    domain: optionalString(formData.get("domain")),
    platform: formData.get("platform") || "vercel",
    locationName: optionalString(formData.get("locationName")),
    city: optionalString(formData.get("city")),
    state: optionalString(formData.get("state")),
    serviceArea: optionalString(formData.get("serviceArea")),
    authorName: optionalString(formData.get("authorName")),
    authorTitle: optionalString(formData.get("authorTitle")),
    authorBio: optionalString(formData.get("authorBio")),
    authorImageUrl: formData.get("authorImageUrl") || "",
    siteApiKey: optionalString(formData.get("siteApiKey")),
    revalidateUrl: formData.get("revalidateUrl") || "",
    revalidateSecret: optionalString(formData.get("revalidateSecret")),
    ghlLocationId: optionalString(formData.get("ghlLocationId")),
    ghlCompanyId: optionalString(formData.get("ghlCompanyId")),
    apiToken: optionalString(formData.get("apiToken")),
    blogId: optionalString(formData.get("blogId")),
    defaultTopic: formData.get("defaultTopic"),
    categories: optionalString(formData.get("categories")),
    postingDays: formData.getAll("postingDays"),
    imageStyle: optionalString(formData.get("imageStyle")),
    automationEnabled: checkboxValue(formData, "automationEnabled"),
    autoPublishEnabled: checkboxValue(formData, "autoPublishEnabled"),
    autoImageEnabled: checkboxValue(formData, "autoImageEnabled"),
  });
  const siteSlug = slugify(parsed.slug || parsed.name);

  await prisma.network.create({
    data: {
      ownerId: user.id,
      name: parsed.name,
      slug: siteSlug,
      domain: parsed.domain,
      platform: parsed.platform,
      locationName: parsed.locationName,
      city: parsed.city,
      state: parsed.state,
      serviceArea: parsed.serviceArea,
      authorName: parsed.authorName,
      authorTitle: parsed.authorTitle,
      authorBio: parsed.authorBio,
      authorImageUrl: parsed.authorImageUrl || null,
      siteApiKeyHash: parsed.siteApiKey
        ? hashApiKey(parsed.siteApiKey)
        : null,
      siteApiKeyHint: parsed.siteApiKey ? apiKeyHint(parsed.siteApiKey) : null,
      revalidateUrl: parsed.revalidateUrl || null,
      revalidateSecret: parsed.revalidateSecret,
      ghlLocationId: parsed.ghlLocationId,
      ghlCompanyId: parsed.ghlCompanyId,
      encryptedCredentialPayload: parsed.apiToken
        ? encryptJson({
            apiToken: parsed.apiToken,
          })
        : null,
      blogConfig: {
        create: {
          blogId: parsed.blogId || null,
          defaultTopic: parsed.defaultTopic,
          categories: listFromText(parsed.categories),
          postingDays: parsed.postingDays,
          imageStyle: parsed.imageStyle,
          automationEnabled: parsed.automationEnabled,
          autoPublishEnabled: parsed.autoPublishEnabled,
          autoImageEnabled: parsed.autoImageEnabled,
        },
      },
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateNetworkAction(formData: FormData) {
  const user = await requireUser();
  const parsed = updateNetworkSchema.parse({
    networkId: formData.get("networkId"),
    name: formData.get("name"),
    slug: optionalString(formData.get("slug")),
    domain: optionalString(formData.get("domain")),
    platform: formData.get("platform") || "vercel",
    locationName: optionalString(formData.get("locationName")),
    city: optionalString(formData.get("city")),
    state: optionalString(formData.get("state")),
    serviceArea: optionalString(formData.get("serviceArea")),
    authorName: optionalString(formData.get("authorName")),
    authorTitle: optionalString(formData.get("authorTitle")),
    authorBio: optionalString(formData.get("authorBio")),
    authorImageUrl: formData.get("authorImageUrl") || "",
    siteApiKey: optionalString(formData.get("siteApiKey")),
    revalidateUrl: formData.get("revalidateUrl") || "",
    revalidateSecret: optionalString(formData.get("revalidateSecret")),
    ghlLocationId: optionalString(formData.get("ghlLocationId")),
    ghlCompanyId: optionalString(formData.get("ghlCompanyId")),
    apiToken: optionalString(formData.get("apiToken")),
    blogId: optionalString(formData.get("blogId")),
    defaultTopic: formData.get("defaultTopic"),
    categories: optionalString(formData.get("categories")),
    postingDays: formData.getAll("postingDays"),
    imageStyle: optionalString(formData.get("imageStyle")),
    automationEnabled: checkboxValue(formData, "automationEnabled"),
    autoPublishEnabled: checkboxValue(formData, "autoPublishEnabled"),
    autoImageEnabled: checkboxValue(formData, "autoImageEnabled"),
  });
  const network = await prisma.network.findFirst({
    where: {
      id: parsed.networkId,
      ownerId: user.id,
    },
    include: {
      blogConfig: true,
    },
  });

  if (!network) {
    dashboardError("Network not found.");
  }

  const siteSlug = slugify(parsed.slug || parsed.name);

  await prisma.network.update({
    where: { id: network.id },
    data: {
      name: parsed.name,
      slug: siteSlug,
      domain: parsed.domain,
      platform: parsed.platform,
      locationName: parsed.locationName,
      city: parsed.city,
      state: parsed.state,
      serviceArea: parsed.serviceArea,
      authorName: parsed.authorName,
      authorTitle: parsed.authorTitle,
      authorBio: parsed.authorBio,
      authorImageUrl: parsed.authorImageUrl || null,
      ...(parsed.siteApiKey
        ? {
            siteApiKeyHash: hashApiKey(parsed.siteApiKey),
            siteApiKeyHint: apiKeyHint(parsed.siteApiKey),
          }
        : {}),
      revalidateUrl: parsed.revalidateUrl || null,
      revalidateSecret: parsed.revalidateSecret,
      ghlLocationId: parsed.ghlLocationId,
      ghlCompanyId: parsed.ghlCompanyId,
      ...(parsed.apiToken
        ? {
            encryptedCredentialPayload: encryptJson({
              apiToken: parsed.apiToken,
            }),
          }
        : {}),
      blogConfig: {
        upsert: {
          create: {
            blogId: parsed.blogId || null,
            defaultTopic: parsed.defaultTopic,
            categories: listFromText(parsed.categories),
            postingDays: parsed.postingDays,
            imageStyle: parsed.imageStyle,
            automationEnabled: parsed.automationEnabled,
            autoPublishEnabled: parsed.autoPublishEnabled,
            autoImageEnabled: parsed.autoImageEnabled,
          },
          update: {
            blogId: parsed.blogId || null,
            defaultTopic: parsed.defaultTopic,
            categories: listFromText(parsed.categories),
            postingDays: parsed.postingDays,
            imageStyle: parsed.imageStyle,
            automationEnabled: parsed.automationEnabled,
            autoPublishEnabled: parsed.autoPublishEnabled,
            autoImageEnabled: parsed.autoImageEnabled,
          },
        },
      },
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function generatePostAction(formData: FormData) {
  const user = await requireUser();
  const parsed = generateSchema.parse({
    networkId: formData.get("networkId"),
    topic: formData.get("topic") || undefined,
  });
  const network = await getOwnedNetwork(parsed.networkId, user.id);

  if (!network?.blogConfig) {
    dashboardError("Network not found or missing blog configuration.");
  }

  const topic = parsed.topic?.trim() || network.blogConfig.defaultTopic;

  try {
    const post = await createDraftFromClaude({
      network,
      topic,
      source: "claude",
    });
    await maybeAutoPublishGeneratedPost({
      postId: post.id,
      network,
      ownerId: user.id,
    });
  } catch (error) {
    console.error("Failed to generate blog draft", error);
    dashboardError(
      error instanceof Error
        ? error.message
        : "Failed to generate blog draft. Check the Railway logs.",
    );
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createTopicAction(formData: FormData) {
  const user = await requireUser();
  const parsed = topicSchema.parse({
    networkId: formData.get("networkId"),
    title: formData.get("title"),
    description: optionalString(formData.get("description")),
    category: optionalString(formData.get("category")),
    priority: formData.get("priority") || 0,
  });
  const network = await getOwnedNetwork(parsed.networkId, user.id);

  if (!network) {
    dashboardError("Site profile not found.");
  }

  await prisma.topic.create({
    data: {
      networkId: network.id,
      title: parsed.title,
      description: parsed.description,
      category: parsed.category,
      priority: parsed.priority,
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function toggleTopicAction(formData: FormData) {
  const user = await requireUser();
  const parsed = topicIdSchema.parse({
    topicId: formData.get("topicId"),
  });
  const topic = await prisma.topic.findFirst({
    where: {
      id: parsed.topicId,
      network: {
        ownerId: user.id,
      },
    },
  });

  if (!topic) {
    dashboardError("Topic not found.");
  }

  await prisma.topic.update({
    where: { id: topic.id },
    data: {
      isActive: !topic.isActive,
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function deleteTopicAction(formData: FormData) {
  const user = await requireUser();
  const parsed = topicIdSchema.parse({
    topicId: formData.get("topicId"),
  });
  const topic = await prisma.topic.findFirst({
    where: {
      id: parsed.topicId,
      network: {
        ownerId: user.id,
      },
    },
  });

  if (!topic) {
    dashboardError("Topic not found.");
  }

  await prisma.topic.delete({
    where: { id: topic.id },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function generateNextTopicPostAction(formData: FormData) {
  const user = await requireUser();
  const parsed = generateSchema.parse({
    networkId: formData.get("networkId"),
  });
  const network = await getOwnedNetwork(parsed.networkId, user.id);

  if (!network?.blogConfig) {
    dashboardError("Site profile not found or missing blog configuration.");
  }

  const topic = await prisma.topic.findFirst({
    where: {
      networkId: network.id,
      isActive: true,
    },
    orderBy: [
      { useCount: "asc" },
      { lastUsedAt: { sort: "asc", nulls: "first" } },
      { priority: "desc" },
      { createdAt: "asc" },
    ],
  });

  if (!topic) {
    dashboardError("Add at least one active topic before generating from the topic bank.");
  }

  const topicText = [topic.title, topic.description]
    .filter(Boolean)
    .join("\n\n");

  try {
    const post = await createDraftFromClaude({
      network,
      topic: topicText,
      source: "topic_queue",
      topicId: topic.id,
    });

    await prisma.topic.update({
      where: { id: topic.id },
      data: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
    await maybeAutoPublishGeneratedPost({
      postId: post.id,
      network,
      ownerId: user.id,
    });
  } catch (error) {
    console.error("Failed to generate queued blog draft", error);
    dashboardError(
      error instanceof Error
        ? error.message
        : "Failed to generate queued blog draft. Check the Railway logs.",
    );
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createManualPostAction(formData: FormData) {
  const user = await requireUser();
  const parsed = manualPostSchema.parse({
    networkId: formData.get("networkId"),
    title: formData.get("title"),
    slug: optionalString(formData.get("slug")),
    excerpt: formData.get("excerpt"),
    bodyMarkdown: formData.get("bodyMarkdown"),
    categories: optionalString(formData.get("categories")),
    seoTitle: optionalString(formData.get("seoTitle")),
    seoDescription: optionalString(formData.get("seoDescription")),
    canonicalUrl: formData.get("canonicalUrl") || "",
    imagePrompt: optionalString(formData.get("imagePrompt")),
    imageUrl: formData.get("imageUrl") || "",
    featuredImageAlt: optionalString(formData.get("featuredImageAlt")),
    scheduledFor: optionalString(formData.get("scheduledFor")),
  });
  const network = await getOwnedNetwork(parsed.networkId, user.id);

  if (!network) {
    dashboardError("Site profile not found.");
  }

  const postSlug = await uniquePostSlug(
    network.id,
    parsed.slug || parsed.title,
  );
  const bodyHtml = markdownToHtml(parsed.bodyMarkdown);

  const post = await prisma.blogPost.create({
    data: {
      networkId: network.id,
      topic: parsed.title,
      title: parsed.title,
      slug: postSlug,
      excerpt: parsed.excerpt,
      bodyMarkdown: parsed.bodyMarkdown,
      bodyHtml,
      categories: listFromText(parsed.categories),
      seoTitle: parsed.seoTitle || parsed.title,
      seoDescription: parsed.seoDescription || parsed.excerpt,
      canonicalUrl: parsed.canonicalUrl || null,
      imagePrompt: parsed.imagePrompt,
      imageUrl: parsed.imageUrl || null,
      featuredImageAlt: parsed.featuredImageAlt || parsed.title,
      imageProvider: parsed.imageUrl ? "manual" : "manual",
      source: "manual",
      scheduledFor: parsed.scheduledFor ? new Date(parsed.scheduledFor) : null,
    },
  });

  if (!parsed.imageUrl && network.blogConfig?.autoImageEnabled) {
    await attachAutomaticPexelsImage({
      postId: post.id,
      query: parsed.imagePrompt || parsed.title,
      fallbackAlt: parsed.featuredImageAlt || parsed.title,
    });
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateDraftAction(formData: FormData) {
  const user = await requireUser();
  const parsed = updateDraftSchema.parse({
    postId: formData.get("postId"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: formData.get("excerpt"),
    bodyMarkdown: formData.get("bodyMarkdown"),
    categories: optionalString(formData.get("categories")),
    seoTitle: optionalString(formData.get("seoTitle")),
    seoDescription: optionalString(formData.get("seoDescription")),
    canonicalUrl: formData.get("canonicalUrl") || "",
    imagePrompt: optionalString(formData.get("imagePrompt")),
    imageUrl: formData.get("imageUrl") || "",
    featuredImageAlt: optionalString(formData.get("featuredImageAlt")),
  });
  const post = await prisma.blogPost.findFirst({
    where: {
      id: parsed.postId,
      network: {
        ownerId: user.id,
      },
    },
    include: {
      network: true,
    },
  });

  if (!post) {
    dashboardError("Draft not found.");
  }

  if (post.status === "published") {
    dashboardError("Published posts cannot be edited from the MVP dashboard.");
  }

  const postSlug = await uniquePostSlug(
    post.networkId,
    parsed.slug,
    post.id,
  );
  const bodyHtml = markdownToHtml(parsed.bodyMarkdown);

  await prisma.blogPost.update({
    where: { id: post.id },
    data: {
      title: parsed.title,
      slug: postSlug,
      excerpt: parsed.excerpt,
      bodyMarkdown: parsed.bodyMarkdown,
      bodyHtml,
      categories: listFromText(parsed.categories),
      seoTitle: parsed.seoTitle || parsed.title,
      seoDescription: parsed.seoDescription || parsed.excerpt,
      canonicalUrl: parsed.canonicalUrl || null,
      imagePrompt: parsed.imagePrompt,
      imageUrl: parsed.imageUrl || null,
      featuredImageAlt: parsed.featuredImageAlt || parsed.title,
      imageProvider: parsed.imageUrl ? "manual" : "manual",
      imageCredit: null,
      imageSourceUrl: null,
      status: "draft",
      errorMessage: null,
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function deletePostAction(formData: FormData) {
  const user = await requireUser();
  const parsed = postIdSchema.parse({
    postId: formData.get("postId"),
  });
  const post = await prisma.blogPost.findFirst({
    where: {
      id: parsed.postId,
      network: {
        ownerId: user.id,
      },
    },
  });

  if (!post) {
    dashboardError("Post not found.");
  }

  await prisma.blogPost.delete({
    where: { id: post.id },
  });

  await revalidatePublishedPost(post);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function findPexelsImagesAction(formData: FormData) {
  const user = await requireUser();
  const parsed = postIdSchema.parse({
    postId: formData.get("postId"),
  });
  const post = await prisma.blogPost.findFirst({
    where: {
      id: parsed.postId,
      network: {
        ownerId: user.id,
      },
    },
  });

  if (!post) {
    dashboardError("Post not found.");
  }

  const query = post.imagePrompt || post.topic || post.title;

  try {
    const candidates = await searchPexelsImages(query);

    await prisma.imageCandidate.deleteMany({
      where: { postId: post.id },
    });

    await prisma.imageCandidate.createMany({
      data: candidates
        .filter((candidate) => candidate.imageUrl)
        .map((candidate) => ({
          postId: post.id,
          imageUrl: candidate.imageUrl,
          photographer: candidate.photographer,
          photographerUrl: candidate.photographerUrl,
          sourceUrl: candidate.sourceUrl,
          altText: candidate.altText,
        })),
    });
  } catch (error) {
    console.error("Failed to search Pexels images", error);
    dashboardError(
      error instanceof Error
        ? error.message
        : "Failed to search Pexels images.",
    );
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function applyImageCandidateAction(formData: FormData) {
  const user = await requireUser();
  const parsed = imageCandidateSchema.parse({
    candidateId: formData.get("candidateId"),
  });
  const candidate = await prisma.imageCandidate.findFirst({
    where: {
      id: parsed.candidateId,
      post: {
        network: {
          ownerId: user.id,
        },
      },
    },
    include: {
      post: {
        include: {
          network: true,
        },
      },
    },
  });

  if (!candidate) {
    dashboardError("Image candidate not found.");
  }

  await prisma.blogPost.update({
    where: { id: candidate.postId },
    data: {
      imageUrl: candidate.imageUrl,
      featuredImageAlt: candidate.altText || candidate.post.title,
      imageProvider: "pexels",
      imageCredit: candidate.photographer
        ? `Photo by ${candidate.photographer} on Pexels`
        : "Photo from Pexels",
      imageSourceUrl: candidate.sourceUrl,
    },
  });

  await revalidatePublishedPost(candidate.post);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function publishPostAction(formData: FormData) {
  const user = await requireUser();
  const parsed = publishSchema.parse({
    postId: formData.get("postId"),
  });
  const post = await getOwnedPostForPublish(parsed.postId, user.id);

  if (!post) {
    throw new Error("Post not found or missing blog configuration.");
  }

  await publishPostRecord(post);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
