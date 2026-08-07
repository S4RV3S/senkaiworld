// Auth helpers using Web Crypto (native to the Workers runtime — no npm deps needed)
import { env } from "cloudflare:workers";
import type { AstroCookies } from "astro";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const saltArray = Array.from(salt);
  return `${saltArray.map((b) => b.toString(16).padStart(2, "0")).join("")}:${hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const computedHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return computedHex === hashHex;
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;

export async function createSession(userId: string): Promise<{ token: string; maxAge: number }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, userId, expiresAt)
    .run();
  return { token, maxAge: SESSION_DAYS * 24 * 60 * 60 };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

export async function getUserFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, users.name, users.role
     FROM sessions JOIN users ON sessions.user_id = users.id
     WHERE sessions.token = ? AND sessions.expires_at > datetime('now')`
  )
    .bind(token)
    .first<SessionUser>();
  return row ?? null;
}

/** Reads the session cookie and resolves the logged-in user, or null. */
export async function getSessionUser(cookies: AstroCookies): Promise<SessionUser | null> {
  return getUserFromToken(cookies.get(SESSION_COOKIE)?.value);
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
