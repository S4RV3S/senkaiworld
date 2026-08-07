import type { APIRoute } from "astro";
import { getSessionUser } from "../../lib/cms/auth";
import { createPost, listAllForAdmin, POST_CATEGORIES, type PostCategory } from "../../lib/cms/posts";

export const prerender = false;

interface PostRequestBody {
  title?: string;
  thumbnailUrl?: string | null;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  category?: string;
  score?: number | string | null;
  contentHtml?: string;
  status?: string;
}

export const GET: APIRoute = async ({ cookies }) => {
  const user = await getSessionUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: "Not logged in" }), { status: 401 });
  }

  const posts = await listAllForAdmin();
  return new Response(JSON.stringify({ posts }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getSessionUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: "Not logged in" }), { status: 401 });
  }

  const body = (await request.json()) as PostRequestBody;
  const { title, thumbnailUrl, excerpt, seoTitle, seoDescription, category, score, contentHtml, status } = body;

  if (!title || !contentHtml) {
    return new Response(JSON.stringify({ error: "Title and content are required" }), { status: 400 });
  }
  if (!category || !POST_CATEGORIES.includes(category as PostCategory)) {
    return new Response(JSON.stringify({ error: "Invalid category" }), { status: 400 });
  }
  if (status !== "draft" && status !== "published") {
    return new Response(JSON.stringify({ error: "Invalid status" }), { status: 400 });
  }

  const result = await createPost(
    {
      title,
      category: category as PostCategory,
      thumbnailUrl,
      excerpt,
      seoTitle,
      seoDescription,
      score: score != null ? Number(score) : null,
      contentHtml,
      status,
    },
    user.id
  );

  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
