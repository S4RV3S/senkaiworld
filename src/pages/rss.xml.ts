import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const anime = await getCollection("anime");
  const manhwa = await getCollection("manhwa");
  const news = await getCollection("news");
  const reviews = await getCollection("reviews");
  const rankings = await getCollection("rankings");

  const items = [
    ...anime,
    ...manhwa,
    ...news,
    ...reviews,
    ...rankings,
  ].map((post) => ({
    title: post.data.title,
    description: post.data.description,
    pubDate: post.data.date,
    link: `/${post.collection}/${post.id}/`,
  }));

  return rss({
    title: "Senkai World",
    description: "Latest anime, manhwa, news, reviews and rankings.",
    site: context.site,
    items,
  });
}