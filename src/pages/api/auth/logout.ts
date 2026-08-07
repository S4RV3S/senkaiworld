import type { APIRoute } from "astro";
import { destroySession, SESSION_COOKIE } from "../../../lib/cms/auth";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  await destroySession(cookies.get(SESSION_COOKIE)?.value);
  cookies.delete(SESSION_COOKIE, { path: "/" });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
