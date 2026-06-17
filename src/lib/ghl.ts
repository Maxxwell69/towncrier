import { decryptJson } from "@/lib/crypto";

type GhlCredentialPayload = {
  apiToken?: string;
  accessToken?: string;
};

export type PublishBlogPostInput = {
  blogId: string;
  locationId?: string | null;
  encryptedCredentialPayload: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyMarkdown: string;
  categories: string[];
  imageUrl?: string | null;
};

export type PublishBlogPostResult = {
  externalId?: string;
  response: unknown;
};

function markdownToSimpleHtml(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();

      if (trimmed.startsWith("# ")) {
        return `<h1>${trimmed.slice(2)}</h1>`;
      }

      if (trimmed.startsWith("## ")) {
        return `<h2>${trimmed.slice(3)}</h2>`;
      }

      if (trimmed.startsWith("### ")) {
        return `<h3>${trimmed.slice(4)}</h3>`;
      }

      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");
}

function parseResponseBody(responseText: string) {
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return { raw: responseText };
  }
}

function buildBlogPostUrl() {
  const baseUrl =
    process.env.GHL_API_BASE_URL ?? "https://services.leadconnectorhq.com";
  const path = process.env.GHL_CREATE_BLOG_POST_PATH ?? "/blogs/posts";

  return new URL(path, baseUrl).toString();
}

export async function publishBlogPost(
  input: PublishBlogPostInput,
): Promise<PublishBlogPostResult> {
  const credentials = decryptJson<GhlCredentialPayload>(
    input.encryptedCredentialPayload,
  );
  const token = credentials.accessToken ?? credentials.apiToken;

  if (!token) {
    throw new Error("No GHL API token found for this network.");
  }

  const response = await fetch(buildBlogPostUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Version: process.env.GHL_API_VERSION ?? "2021-07-28",
    },
    body: JSON.stringify({
      title: input.title,
      locationId: input.locationId,
      blogId: input.blogId,
      urlSlug: input.slug,
      description: input.excerpt,
      rawHTML: markdownToSimpleHtml(input.bodyMarkdown),
      categories: input.categories,
      imageUrl: input.imageUrl,
      status: "PUBLISHED",
    }),
  });

  const responseText = await response.text();
  const responseBody = parseResponseBody(responseText);

  if (!response.ok) {
    throw new Error(
      `GHL publish failed (${response.status}): ${responseText || response.statusText}`,
    );
  }

  const externalId =
    typeof responseBody === "object" && responseBody !== null
      ? String(
          "id" in responseBody
            ? responseBody.id
            : "postId" in responseBody
              ? responseBody.postId
              : "",
        ) || undefined
      : undefined;

  return {
    externalId,
    response: responseBody,
  };
}
