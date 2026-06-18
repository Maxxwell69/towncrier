import { z } from "zod";

const pexelsPhotoSchema = z.object({
  url: z.string(),
  alt: z.string().nullable().optional(),
  photographer: z.string().nullable().optional(),
  photographer_url: z.string().nullable().optional(),
  src: z.object({
    large: z.string().optional(),
    large2x: z.string().optional(),
    original: z.string().optional(),
    medium: z.string().optional(),
    landscape: z.string().optional(),
  }),
});

const pexelsSearchSchema = z.object({
  photos: z.array(pexelsPhotoSchema),
});

export type PexelsImageCandidate = {
  imageUrl: string;
  photographer?: string | null;
  photographerUrl?: string | null;
  sourceUrl?: string | null;
  altText?: string | null;
};

export async function searchPexelsImages(query: string) {
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey) {
    throw new Error("PEXELS_API_KEY is required to search Pexels images.");
  }

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "6");
  url.searchParams.set("orientation", "landscape");

  const response = await fetch(url, {
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
    },
  });
  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `Pexels search failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }

  const parsed = pexelsSearchSchema.parse(body);

  return parsed.photos.map<PexelsImageCandidate>((photo) => ({
    imageUrl:
      photo.src.large2x ??
      photo.src.large ??
      photo.src.landscape ??
      photo.src.medium ??
      photo.src.original ??
      "",
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url,
    sourceUrl: photo.url,
    altText: photo.alt || query,
  }));
}
