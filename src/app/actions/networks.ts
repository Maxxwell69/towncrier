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

const generateSchema = z.object({
  networkId: z.string().min(1),
  topic: z.string().optional(),
});

const publishSchema = z.object({
  postId: z.string().min(1),
});

function listFromText(value?: string) {
  return (value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
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
    throw new Error("Network not found or missing blog configuration.");
  }

  const topic = parsed.topic?.trim() || network.blogConfig.defaultTopic;
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
