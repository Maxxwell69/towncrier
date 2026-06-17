"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { generateBlogDraft } from "@/lib/claude";
import { encryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { publishBlogPost } from "@/lib/ghl";

const networkSchema = z.object({
  name: z.string().min(2),
  ghlLocationId: z.string().optional(),
  ghlCompanyId: z.string().optional(),
  apiToken: z.string().min(1),
  blogId: z.string().min(1),
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
  imagePrompt: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

function listFromText(value?: string) {
  return (value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dashboardError(message: string): never {
  redirect(`/dashboard?error=${encodeURIComponent(message)}`);
}

export async function createNetworkAction(formData: FormData) {
  const user = await requireUser();
  const parsed = networkSchema.parse({
    name: formData.get("name"),
    ghlLocationId: formData.get("ghlLocationId") || undefined,
    ghlCompanyId: formData.get("ghlCompanyId") || undefined,
    apiToken: formData.get("apiToken"),
    blogId: formData.get("blogId"),
    defaultTopic: formData.get("defaultTopic"),
    categories: formData.get("categories") || undefined,
    postingDays: formData.getAll("postingDays"),
    imageStyle: formData.get("imageStyle") || undefined,
  });

  await prisma.network.create({
    data: {
      ownerId: user.id,
      name: parsed.name,
      ghlLocationId: parsed.ghlLocationId,
      ghlCompanyId: parsed.ghlCompanyId,
      encryptedCredentialPayload: encryptJson({
        apiToken: parsed.apiToken,
      }),
      blogConfig: {
        create: {
          blogId: parsed.blogId,
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
    ghlLocationId: formData.get("ghlLocationId") || undefined,
    ghlCompanyId: formData.get("ghlCompanyId") || undefined,
    apiToken: formData.get("apiToken") || undefined,
    blogId: formData.get("blogId"),
    defaultTopic: formData.get("defaultTopic"),
    categories: formData.get("categories") || undefined,
    postingDays: formData.getAll("postingDays"),
    imageStyle: formData.get("imageStyle") || undefined,
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

  await prisma.network.update({
    where: { id: network.id },
    data: {
      name: parsed.name,
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
            blogId: parsed.blogId,
            defaultTopic: parsed.defaultTopic,
            categories: listFromText(parsed.categories),
            postingDays: parsed.postingDays,
            imageStyle: parsed.imageStyle,
          },
          update: {
            blogId: parsed.blogId,
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
      topic,
      categories: network.blogConfig.categories,
      imageStyle: network.blogConfig.imageStyle,
    });

    await prisma.blogPost.create({
      data: {
        networkId: network.id,
        topic,
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt,
        bodyMarkdown: draft.bodyMarkdown,
        categories: draft.categories,
        imagePrompt: draft.imagePrompt,
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
    categories: formData.get("categories") || undefined,
    imagePrompt: formData.get("imagePrompt") || undefined,
    imageUrl: formData.get("imageUrl") || "",
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

  await prisma.blogPost.update({
    where: { id: post.id },
    data: {
      title: parsed.title,
      slug: parsed.slug,
      excerpt: parsed.excerpt,
      bodyMarkdown: parsed.bodyMarkdown,
      categories: listFromText(parsed.categories),
      imagePrompt: parsed.imagePrompt,
      imageUrl: parsed.imageUrl || null,
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

  await prisma.blogPost.update({
    where: { id: post.id },
    data: {
      status: "publishing",
      errorMessage: null,
    },
  });

  try {
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
        status: "published",
        ghlPostId: result.externalId,
        publishResponse: result.response as Prisma.InputJsonValue,
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

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
