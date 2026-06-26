/**
 * Facebook Graph API — post a blog link to a Facebook Page feed.
 *
 * Uses a Page Access Token stored (encrypted) per site profile.
 * Get yours from Meta's Graph API Explorer:
 *   https://developers.facebook.com/tools/explorer/
 *
 * Required permissions on the token: pages_manage_posts, pages_read_engagement
 * Token type: Page Access Token (not User token)
 */

const GRAPH_API_VERSION = "v22.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type FacebookPostResult = {
  id: string;
  postUrl: string;
};

export type PostToFacebookInput = {
  pageId: string;
  pageAccessToken: string;
  /** Main text shown above the link preview. */
  message: string;
  /** URL that Facebook will render as a link-preview card. */
  link: string;
};

/**
 * Posts a link to the page feed and returns the new post's ID and URL.
 * Throws on API error with a descriptive message.
 */
export async function postToFacebookPage(
  input: PostToFacebookInput,
): Promise<FacebookPostResult> {
  const res = await fetch(`${GRAPH_BASE}/${input.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input.message,
      link: input.link,
      access_token: input.pageAccessToken,
    }),
  });

  const data = (await res.json()) as {
    id?: string;
    error?: { message: string; code: number; type: string };
  };

  if (!res.ok || data.error) {
    const msg = data.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Facebook API error: ${msg}`);
  }

  if (!data.id) {
    throw new Error("Facebook API returned no post ID.");
  }

  return {
    id: data.id,
    postUrl: `https://www.facebook.com/${data.id}`,
  };
}

/**
 * Build the Facebook post message from a blog post.
 * Format: Title \n\n Excerpt \n\n Read the full post → URL
 */
export function buildFacebookMessage(input: {
  title: string;
  excerpt: string;
  url: string;
}) {
  return [
    input.title,
    "",
    input.excerpt,
    "",
    `Read the full post → ${input.url}`,
  ].join("\n");
}
