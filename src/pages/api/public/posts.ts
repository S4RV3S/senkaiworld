import type { APIRoute } from "astro";
import { listPublished, POST_CATEGORIES, type PostCategory } from "../../../lib/cms/posts";

export const prerender = false;

// Public, read-only: powers the client-side "new posts" injection on the
// static /news, /reviews, /rankings listing pages so newly published CMS
// posts show up there without a full site rebuild.
export const GET: APIRoute = async ({ url }) => {
  const category = url.searchParams.get("category");

  if (!category || !POST_CATEGORIES.includes(category as PostCategory)) {
    return new Response(JSON.stringify({ error: "Invalid or missing category" }), { status: 400 });
  }

  const posts = await listPublished(category as PostCategory);

  const shaped = posts.slice(0, 24).map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    description: p.seo_description,
    image: p.thumbnail_url ?? "/images/placeholder.jpg",
    date: p.published_at ?? p.created_at,
    score: p.score,
  }));

  return new Response(JSON.stringify({ posts: shaped }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
};
