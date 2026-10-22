// One Prisma client per server process. node-postgres over TCP works for both local Docker and Neon's
// pooled endpoint (DATABASE_URL), so dev, tests and Vercel run the same driver.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

export type Db = PrismaClient;
/** A client or an open transaction: what use cases and imports receive. */
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export function createDb(url = process.env.DATABASE_URL): Db {
  if (!url) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

// created on first use (so builds without a database work) and kept across Next.js dev hot reloads
const g = globalThis as unknown as { obiadkiDb?: Db };
export const getDb = (): Db => (g.obiadkiDb ??= createDb());

/** Empties every app table (not the migrations table). For seeding, tests and the one-off sheet import only. */
export async function truncateAll(d: Tx) {
  const rows = await d.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length) await d.$executeRawUnsafe(`TRUNCATE ${rows.map(r => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}
