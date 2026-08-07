import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { verifyPassword, createSession, SESSION_COOKIE } from "../../../lib/cms/auth";

export const prerender = false;

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
}

interface LoginBody {
  email: string;
  password: string;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password } = (await request.json()) as LoginBody;

  if (!email || !password) {
    return new Response(JSON.stringify({ error: "Email and password are required" }), { status: 400 });
  }

  const user = await env.DB.prepare(
    "SELECT id, email, name, password_hash, role FROM users WHERE email = ?"
  )
    .bind(email)
    .first<UserRow>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return new Response(JSON.stringify({ error: "Invalid email or password" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { token, maxAge } = await createSession(user.id);

  cookies.set(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge,
  });

  return new Response(JSON.stringify({ ok: true, name: user.name }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
