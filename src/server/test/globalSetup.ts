// Before the db tests: bring the local test database up to the committed migrations. Tests empty the tables
// themselves (truncateAll), so this only ever applies pending migrations and never drops anything.
// After editing an already-applied migration, wipe the local databases with `npm run db:reset`.
import { execFileSync } from "node:child_process";

export default function setup() {
  const url = process.env.OBIADKI_TEST_DB ?? "";
  const host = url ? new URL(url).hostname : "";
  if (!["localhost", "127.0.0.1", "postgres"].includes(host)) {
    throw new Error(`db tests empty their database; refusing to run against "${host || "(unset)"}". Set TEST_DATABASE_URL to a local database.`);
  }
  try {
    execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "pipe", shell: true, env: { ...process.env, DIRECT_URL: url, DATABASE_URL: url } });
  } catch (e) {
    const out = String((e as { stdout?: Buffer }).stdout ?? "") + String((e as { stderr?: Buffer }).stderr ?? "");
    throw new Error(`Couldn't migrate the test database (is it running? \`npm run db:up\`):\n${out}`);
  }
}
