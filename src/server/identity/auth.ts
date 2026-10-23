// Better Auth: email + password accounts, cookie sessions, user/admin roles (admin plugin).
// Users and sessions live in our own Postgres tables (see the identity section of prisma/schema.prisma).
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { getDb } from "../db";

const DAY = 60 * 60 * 24;

// On Vercel previews, also accept the deployment's own URL and its branch alias (system env vars set by Vercel),
// so BETTER_AUTH_URL can name one of them and sign-in still works from the other.
const vercelOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean).map(h => `https://${h}`);

function createAuth() {
  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? vercelOrigins.at(-1),
    trustedOrigins: vercelOrigins,
    database: prismaAdapter(getDb(), { provider: "postgresql" }),
    emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
    // the app works offline for long stretches, so sessions are long and renew themselves while in use
    session: { expiresIn: 60 * DAY, updateAge: DAY },
    plugins: [admin(), nextCookies()], // nextCookies must stay last
  });
}

export type Auth = ReturnType<typeof createAuth>;

// created on first use, like the database client, so `next build` works without env vars
const g = globalThis as unknown as { obiadkiAuth?: Auth };
export const getAuth = (): Auth => (g.obiadkiAuth ??= createAuth());

export type SessionUser = { id: string; name: string; email: string; role: string };

/** The signed-in user for a request, or null. */
export async function sessionUser(headers: Headers): Promise<SessionUser | null> {
  const s = await getAuth().api.getSession({ headers });
  if (!s) return null;
  const { id, name, email, role } = s.user as typeof s.user & { role?: string | null };
  return { id, name, email, role: role ?? "user" };
}
