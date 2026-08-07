import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import { listPublished, toEntryShape } from "../lib/cms/posts";

export const prerender = false;

export async function GET(context: APIContext) {
  const anime = await getCollection("anime");
  const manhwa = await getCollection("manhwa");
  const news = await getCollection("news");
  const reviews = await getCollection("reviews");
  const rankings = await getCollection("rankings");

  const cmsPosts = [
    ...(await listPublished("news")).map(toEntryShape),
    ...(await listPublished("reviews")).map(toEntryShape),
    ...(await listPublished("rankings")).map(toEntryShape),
  ];

  const items = [
    ...anime,
    ...manhwa,
    ...news,
    ...reviews,
    ...rankings,
    ...cmsPosts,
  ].map((post) => ({
    title: post.data.title,
    description: post.data.description,
    pubDate: post.data.date,
    link:
      "source" in post && post.source === "cms"
        ? `/${post.collection}/post/${post.id}/`
        : `/${post.collection}/${post.id}/`,
  }));

  return rss({
    title: "Senkai World",
    description: "Latest anime, manhwa, news, reviews and rankings.",
    site: context.site!,
    items,
  });
}