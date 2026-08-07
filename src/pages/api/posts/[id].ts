import type { APIRoute } from "astro";
import { getSessionUser } from "../../../lib/cms/auth";
import {
  deletePost,
  getPostById,
  POST_CATEGORIES,
  updatePost,
  type PostCategory,
} from "../../../lib/cms/posts";

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

export const GET: APIRoute = async ({ params, cookies }) => {
  const user = await getSessionUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: "Not logged in" }), { status: 401 });
  }

  const post = params.id ? await getPostById(params.id) : null;
  if (!post) {
    return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 });
  }

  return new Response(JSON.stringify({ post }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const user = await getSessionUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: "Not logged in" }), { status: 401 });
  }
  if (!params.id) {
    return new Response(JSON.stringify({ error: "Missing post id" }), { status: 400 });
  }

  const existing = await getPostById(params.id);
  if (!existing) {
    return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 });
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

  await updatePost(params.id, {
    title,
    category: category as PostCategory,
    thumbnailUrl,
    excerpt,
    seoTitle,
    seoDescription,
    score: score != null ? Number(score) : null,
    contentHtml,
    status,
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const user = await getSessionUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: "Not logged in" }), { status: 401 });
  }
  if (!params.id) {
    return new Response(JSON.stringify({ error: "Missing post id" }), { status: 400 });
  }

  await deletePost(params.id);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
