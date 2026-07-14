import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const baseSchema = z.object({
  title: z.string(),
  description: z.string(),
  excerpt: z.string(),
  image: z.string(),
  category: z.string(),
  author: z.string(),
  date: z.coerce.date(),
  featured: z.boolean().default(false),
  trending: z.boolean().default(false),
  homepage: z.boolean().default(false),
  draft: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const news = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/news",
  }),
  schema: baseSchema,
});

const anime = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/anime",
  }),
  schema: baseSchema.extend({
    studio: z.string(),
    episodes: z.number(),
    status: z.string(),
    score: z.number(),
  }),
});

const manhwa = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/manhwa",
  }),
  schema: baseSchema.extend({
    chapters: z.coerce.number(),
    status: z.string(),
    score: z.coerce.number(),
    authorName: z.string(),
    artist: z.string(),
  }),
});

const reviews = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/reviews",
  }),
  schema: baseSchema.extend({
    score: z.number(),
  }),
});


const rankings = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/content/rankings",
  }),
  schema: baseSchema,
});

export const collections = {
  news,
  anime,
 manhwa,
  reviews,
  rankings,
};