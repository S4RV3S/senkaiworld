import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getSessionUser } from "../../lib/cms/auth";

export const prerender = false;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const MAX_BYTES = 5 * 1024 * 1024;
// Each upload gets a fresh, never-reused UUID key, so it's safe to cache
// forever from the browser/edge's point of view. 60 days is a middle ground
// in the 30-90 day range — long enough that repeat views almost never hit
// R2 directly, short enough to bound how long a deleted/replaced image
// could theoretically linger in caches.
const IMAGE_CACHE_CONTROL = "public, max-age=5184000, immutable"; // 60 days

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getSessionUser(cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: "Not logged in" }), { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return new Response(JSON.stringify({ error: "Unsupported image type" }), { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: "Image must be under 5MB" }), { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const key = `${crypto.randomUUID()}.${ext}`;

  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type, cacheControl: IMAGE_CACHE_CONTROL },
  });

  const publicUrl = `${env.R2_PUBLIC_URL}/${key}`;

  return new Response(JSON.stringify({ url: publicUrl }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
