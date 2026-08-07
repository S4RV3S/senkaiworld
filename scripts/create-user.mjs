// One-time helper to create an admin/writer user.
// Usage: node scripts/create-user.mjs "you@email.com" "Your Name" "yourpassword" [role]
// Prints a `wrangler d1 execute` command you run yourself against the remote DB.

import { webcrypto as crypto } from "node:crypto";
import { randomUUID } from "node:crypto";

const [, , email, name, password, role = "admin"] = process.argv;

if (!email || !name || !password) {
  console.error('Usage: node scripts/create-user.mjs "email" "name" "password" [role]');
  process.exit(1);
}

async function hashPassword(password) {
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

const id = randomUUID();
const hash = await hashPassword(password);
const escapedName = name.replace(/'/g, "''");
const escapedEmail = email.replace(/'/g, "''");

const sql = `INSERT INTO users (id, email, name, password_hash, role) VALUES ('${id}', '${escapedEmail}', '${escapedName}', '${hash}', '${role}');`;

console.log("\nRun this against your remote D1 database:\n");
console.log(`npx wrangler d1 execute senkai-cms --remote --command="${sql}"`);
console.log("\nOr against your local dev database (used by `astro dev`):\n");
console.log(`npx wrangler d1 execute senkai-cms --local --command="${sql}"`);
