# Vercel Site Integration

Towncrier is the blog source of truth. Each Vercel website adds a `/blog` index and `/blog/[slug]` detail route that fetch published posts from Towncrier.

## Environment Variables

Add these to the Vercel website:

```text
TOWNCRIER_API_URL=https://towncrier-production.up.railway.app
TOWNCRIER_SITE_SLUG=fairless-hills-chiropractor
TOWNCRIER_SITE_API_KEY=
TOWNCRIER_REVALIDATE_SECRET=
```

Published posts are public by site slug for the MVP, so `TOWNCRIER_SITE_API_KEY` can be blank unless you add preview/draft access later.

## Shared Fetch Helper

```ts
const towncrierApiUrl = process.env.TOWNCRIER_API_URL!;
const siteSlug = process.env.TOWNCRIER_SITE_SLUG!;

export async function getTowncrierPosts() {
  const response = await fetch(
    `${towncrierApiUrl}/api/v1/sites/${siteSlug}/posts`,
    { next: { revalidate: 300 } },
  );

  if (!response.ok) {
    throw new Error("Failed to load blog posts.");
  }

  return response.json();
}

export async function getTowncrierPost(slug: string) {
  const response = await fetch(
    `${towncrierApiUrl}/api/v1/sites/${siteSlug}/posts/${slug}`,
    { next: { revalidate: 300 } },
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}
```

## App Router Blog Index

Create `src/app/blog/page.tsx` in the Vercel site:

```tsx
import Link from "next/link";
import { getTowncrierPosts } from "@/lib/towncrier";

export default async function BlogPage() {
  const { posts } = await getTowncrierPosts();

  return (
    <main>
      <h1>Blog</h1>
      <div>
        {posts.map((post: any) => (
          <article key={post.id}>
            <h2>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <p>{post.excerpt}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
```

## App Router Blog Detail

Create `src/app/blog/[slug]/page.tsx` in the Vercel site:

```tsx
import { notFound } from "next/navigation";
import { getTowncrierPost } from "@/lib/towncrier";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getTowncrierPost(slug);

  if (!data?.post) {
    notFound();
  }

  const post = data.post;

  return (
    <main>
      <article>
        <h1>{post.title}</h1>
        <p>{post.excerpt}</p>
        {post.featuredImage.url ? (
          <img src={post.featuredImage.url} alt={post.featuredImage.alt} />
        ) : null}
        <div dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
      </article>
    </main>
  );
}
```

## Optional Revalidation Route

Create `src/app/api/revalidate/route.ts` in the Vercel site:

```ts
import { revalidatePath } from "next/cache";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.TOWNCRIER_REVALIDATE_SECRET}`;

  if (process.env.TOWNCRIER_REVALIDATE_SECRET && auth !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  revalidatePath("/blog");

  if (body?.path) {
    revalidatePath(body.path);
  }

  return Response.json({ revalidated: true });
}
```

Then paste the live Vercel URL into the Towncrier site profile:

```text
https://fairlesshillschiropractor.com/api/revalidate
```
