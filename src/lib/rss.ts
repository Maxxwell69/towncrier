export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  author?: string;
  categories?: string[];
  imageUrl?: string;
};

export type RssFeedOptions = {
  title: string;
  siteUrl: string;
  feedUrl: string;
  description: string;
  items: RssItem[];
};

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildRssFeed(opts: RssFeedOptions): string {
  const items = opts.items
    .map((item) => {
      const categories = (item.categories ?? [])
        .map((c) => `    <category>${escapeXml(c)}</category>`)
        .join("\n");

      const enclosure = item.imageUrl
        ? `    <enclosure url="${escapeXml(item.imageUrl)}" type="image/jpeg" length="0" />`
        : "";

      return `  <item>
    <title>${escapeXml(item.title)}</title>
    <link>${escapeXml(item.link)}</link>
    <guid isPermaLink="true">${escapeXml(item.guid)}</guid>
    <description>${escapeXml(item.description)}</description>
    <pubDate>${item.pubDate}</pubDate>
${item.author ? `    <author>${escapeXml(item.author)}</author>` : ""}
${categories}
${enclosure}
  </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(opts.title)}</title>
    <link>${escapeXml(opts.siteUrl)}</link>
    <description>${escapeXml(opts.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(opts.feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

export function rssResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
