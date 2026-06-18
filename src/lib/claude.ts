import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const draftSchema = z.object({
  title: z.string().min(5),
  slug: z.string().min(3),
  excerpt: z.string().min(20),
  bodyMarkdown: z.string().min(200),
  categories: z.array(z.string()).default([]),
  imagePrompt: z.string().optional(),
});

export type GeneratedDraft = z.infer<typeof draftSchema>;

type GenerateBlogDraftInput = {
  networkName: string;
  domain?: string | null;
  locationName?: string | null;
  city?: string | null;
  state?: string | null;
  serviceArea?: string | null;
  authorName?: string | null;
  authorTitle?: string | null;
  topic: string;
  categories: string[];
  imageStyle?: string | null;
};

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fenced?.[1]) {
    return fenced[1];
  }

  return trimmed;
}

export async function generateBlogDraft(input: GenerateBlogDraftInput) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required to generate blog drafts.");
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await anthropic.messages.create({
    model: process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-latest",
    max_tokens: 4000,
    temperature: 0.7,
    system:
      "You write practical, SEO-conscious website blog posts. Return only valid JSON matching the requested schema.",
    messages: [
      {
        role: "user",
        content: [
          `Website/network: ${input.networkName}`,
          `Domain: ${input.domain || "not provided"}`,
          `Location: ${[input.locationName, input.city, input.state].filter(Boolean).join(", ") || "not provided"}`,
          `Service area: ${input.serviceArea || "not provided"}`,
          `Author: ${[input.authorName, input.authorTitle].filter(Boolean).join(", ") || "not provided"}`,
          `Topic: ${input.topic}`,
          `Preferred categories: ${input.categories.join(", ") || "none"}`,
          `Image style: ${input.imageStyle || "natural editorial image"}`,
          "",
          "Write a complete blog draft. Return JSON with exactly these keys:",
          "title, slug, excerpt, bodyMarkdown, categories, imagePrompt.",
          "Use markdown for bodyMarkdown. Do not include markdown fences around the JSON.",
        ].join("\n"),
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  const parsed = JSON.parse(extractJson(text)) as unknown;

  return draftSchema.parse(parsed);
}
