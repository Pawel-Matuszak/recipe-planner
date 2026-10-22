// `npx prisma db seed`: replaces everything with the demo data from src/mock.ts, plus a demo admin and household.
// Wipes the database first, so it refuses to run against anything but localhost unless SEED_ALLOW_REMOTE=1.
import { existsSync } from "node:fs";
import { createDb, truncateAll } from "../src/server/db";
import { importModel } from "../src/server/import/fromModel";
import { demoTables } from "../src/mock";
import { buildModel } from "../src/model";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export const DEMO_USER = { id: "demo-admin", name: "Demo", email: "demo@obiadki.local", role: "admin" };

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL is not set");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "postgres"].includes(host) && process.env.SEED_ALLOW_REMOTE !== "1") {
    throw new Error(`Refusing to wipe and seed ${host}. Set SEED_ALLOW_REMOTE=1 if this really is a dev database.`);
  }

  const db = createDb(url);
  try {
    const counts = await db.$transaction(async tx => {
      await truncateAll(tx);
      await tx.user.create({ data: DEMO_USER });
      const household = await tx.household.create({ data: { name: "Demo", members: { create: { userId: DEMO_USER.id, role: "owner" } } } });
      return importModel(tx, buildModel(demoTables()), { householdId: household.id, createdById: DEMO_USER.id });
    }, { timeout: 60_000 });
    console.log(`Seeded ${host}:`, counts);
  } finally {
    await db.$disconnect();
  }
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
