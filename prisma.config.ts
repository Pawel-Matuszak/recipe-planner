import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma doesn't read .env.local; variables already set (CI, Vercel, npm scripts) win over the file.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // migrations need a direct (unpooled) connection
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
});
