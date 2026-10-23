import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const env = loadEnv("test", process.cwd(), "");
// database tests always use a local, disposable database; never the DATABASE_URL from .env.local (that's Neon)
const testDb = env.TEST_DATABASE_URL ?? "postgresql://obiadki:obiadki@localhost:54322/obiadki_test";
process.env.OBIADKI_TEST_DB = testDb; // read by globalSetup, which runs in this process

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      { extends: true, test: { name: "unit", environment: "node", include: ["src/**/*.test.{ts,tsx}"], exclude: ["src/**/*.db.test.ts"] } },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["src/**/*.db.test.ts"],
          env: { DATABASE_URL: testDb, DIRECT_URL: testDb, BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret", BETTER_AUTH_URL: "http://localhost:3000" },
          globalSetup: ["src/server/test/globalSetup.ts"],
          fileParallelism: false, // test files share one database
        },
      },
    ],
  },
});
