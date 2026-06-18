"use server";

import type { Prisma } from "@prisma/client";
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
});

const updateNetworkSchema = networkSchema.extend({
  networkId: z.string().min(1),
  apiToken: z.string().optional(),
});

const generateSchema = z.object({
  networkId: z.string().min(1),
  topic: z.string().optional(),
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
          },
          update: {
            blogId: parsed.blogId || null,
            defaultTopic: parsed.defaultTopic,
            categories: listFromText(parsed.categories),
            postingDays: parsed.postingDays,
            imageStyle: parsed.imageStyle,
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
  const network = await prisma.network.findFirst({
    where: {
      id: parsed.networkId,
      ownerId: user.id,
    },
    include: {
      blogConfig: true,
    },
  });

  if (!network?.blogConfig) {
    dashboardError("Network not found or missing blog configuration.");
  }

  const topic = parsed.topic?.trim() || network.blogConfig.defaultTopic;
  const existingDraft = await prisma.blogPost.findFirst({
    where: {
      networkId: network.id,
      topic: {
        equals: topic,
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
      topic,
      categories: network.blogConfig.categories,
      imageStyle: network.blogConfig.imageStyle,
    });
    const postSlug = await uniquePostSlug(network.id, draft.slug || draft.title);
    const bodyHtml = markdownToHtml(draft.bodyMarkdown);

    await prisma.blogPost.create({
      data: {
        networkId: network.id,
        topic,
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
      },
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

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function publishPostAction(formData: FormData) {
  const user = await requireUser();
  const parsed = publishSchema.parse({
    postId: formData.get("postId"),
  });
  const post = await prisma.blogPost.findFirst({
    where: {
      id: parsed.postId,
      network: {
        ownerId: user.id,
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

  if (!post?.network.blogConfig) {
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
    } else {
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
    }
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

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
