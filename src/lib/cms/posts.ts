import { env } from "cloudflare:workers";
import { slugify } from "./auth";

export type PostCategory = "news" | "reviews" | "rankings";
export const POST_CATEGORIES: PostCategory[] = ["news", "reviews", "rankings"];

export interface CmsPost {
  id: string;
  title: string;
  slug: string;
  category: PostCategory;
  thumbnail_url: string | null;
  excerpt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  score: number | null;
  content_html: string;
  status: "draft" | "published";
  author_id: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface CmsPostWithAuthor extends CmsPost {
  author_name: string;
}

export interface PostInput {
  title: string;
  category: PostCategory;
  thumbnailUrl?: string | null;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  score?: number | null;
  contentHtml: string;
  status: "draft" | "published";
}

/** Strips tags and collapses whitespace to build a card teaser when no excerpt was given. */
export function deriveExcerpt(html: string, maxLen = 160): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}…`;
}

export async function listPublished(category: PostCategory): Promise<CmsPost[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM posts WHERE category = ? AND status = 'published' ORDER BY published_at DESC`
  )
    .bind(category)
    .all<CmsPost>();
  return results;
}

export async function getPublishedBySlug(category: PostCategory, slug: string): Promise<CmsPost | null> {
  const row = await env.DB.prepare(
    `SELECT * FROM posts WHERE category = ? AND slug = ? AND status = 'published'`
  )
    .bind(category, slug)
    .first<CmsPost>();
  return row ?? null;
}

export async function listAllForAdmin(): Promise<CmsPostWithAuthor[]> {
  const { results } = await env.DB.prepare(
    `SELECT posts.*, users.name AS author_name
     FROM posts JOIN users ON posts.author_id = users.id
     ORDER BY posts.created_at DESC LIMIT 200`
  ).all<CmsPostWithAuthor>();
  return results;
}

export async function getPostById(id: string): Promise<CmsPost | null> {
  const row = await env.DB.prepare(`SELECT * FROM posts WHERE id = ?`).bind(id).first<CmsPost>();
  return row ?? null;
}

export async function createPost(input: PostInput, authorId: string): Promise<{ id: string; slug: string }> {
  const id = crypto.randomUUID();
  const slug = `${slugify(input.title)}-${id.slice(0, 6)}`;
  const now = new Date().toISOString();
  const excerpt = input.excerpt?.trim() || deriveExcerpt(input.contentHtml);
  const publishedAt = input.status === "published" ? now : null;

  await env.DB.prepare(
    `INSERT INTO posts
      (id, title, slug, category, thumbnail_url, excerpt, seo_title, seo_description, score, content_html, status, author_id, created_at, updated_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      input.title,
      slug,
      input.category,
      input.thumbnailUrl ?? null,
      excerpt,
      input.seoTitle?.trim() || input.title,
      input.seoDescription?.trim() || excerpt,
      input.category === "reviews" ? input.score ?? null : null,
      input.contentHtml,
      input.status,
      authorId,
      now,
      now,
      publishedAt
    )
    .run();

  return { id, slug };
}

export async function updatePost(id: string, input: PostInput): Promise<void> {
  const existing = await getPostById(id);
  if (!existing) throw new Error("Post not found");

  const now = new Date().toISOString();
  const excerpt = input.excerpt?.trim() || deriveExcerpt(input.contentHtml);
  const publishedAt =
    input.status === "published" ? existing.published_at ?? now : existing.published_at;

  await env.DB.prepare(
    `UPDATE posts SET
       title = ?, category = ?, thumbnail_url = ?, excerpt = ?, seo_title = ?, seo_description = ?,
       score = ?, content_html = ?, status = ?, updated_at = ?, published_at = ?
     WHERE id = ?`
  )
    .bind(
      input.title,
      input.category,
      input.thumbnailUrl ?? null,
      excerpt,
      input.seoTitle?.trim() || input.title,
      input.seoDescription?.trim() || excerpt,
      input.category === "reviews" ? input.score ?? null : null,
      input.contentHtml,
      input.status,
      now,
      publishedAt,
      id
    )
    .run();
}

export async function deletePost(id: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(id).run();
}

const CATEGORY_LABEL: Record<PostCategory, string> = {
  news: "News",
  reviews: "Reviews",
  rankings: "Rankings",
};

/** Shapes a CMS post like an Astro content-collection entry so listing pages can render both with the same markup. */
export function toEntryShape(post: CmsPost) {
  return {
    id: post.slug,
    collection: post.category,
    source: "cms" as const,
    data: {
      title: post.title,
      description: post.seo_description ?? post.excerpt ?? "",
      excerpt: post.excerpt ?? deriveExcerpt(post.content_html),
      image: post.thumbnail_url ?? "/images/placeholder.jpg",
      category: CATEGORY_LABEL[post.category],
      author: "Senkai Team",
      date: new Date(post.published_at ?? post.created_at),
      score: post.score ?? undefined,
    },
  };
}
