import type { APIContext } from "astro";
import { listPublished, POST_CATEGORIES } from "../lib/cms/posts";

export const prerender = false;

// @astrojs/sitemap only knows about pages that were statically generated at
// build time, so CMS posts (published on-demand, no rebuild) never make it
// into sitemap-index.xml. This is a second, independently-listed sitemap
// (referenced from robots.txt) that's rendered live from D1 on every
// request, so newly published posts are indexed without waiting for a
// rebuild — without touching the existing static sitemap at all.
export async function GET(context: APIContext) {
  const site = context.site?.origin ?? "https://senkaiworld.in";

  const allPosts = (
    await Promise.all(POST_CATEGORIES.map((category) => listPublished(category)))
  ).flat();

  const urls = allPosts
    .map(
      (post) => `  <url>
    <loc>${site}/${post.category}/post/${post.slug}</loc>
    <lastmod>${new Date(post.updated_at).toISOString()}</lastmod>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
}
