// npx tsx scripts/set-role.ts <email> <admin|user>
// Changes a user's role in the database from DATABASE_URL (.env.local unless set). The user must have signed up already.
import { existsSync } from "node:fs";
import { createDb } from "../src/server/db";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !["admin", "user"].includes(role)) throw new Error("Usage: npx tsx scripts/set-role.ts <email> <admin|user>");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = createDb(url);
  try {
    const user = await db.user.update({ where: { email: email.trim().toLowerCase() }, data: { role } }).catch(() => null);
    if (!user) throw new Error(`No user with email ${email} in ${new URL(url).hostname}. Sign up in the app first.`);
    console.log(`${user.email} is now "${user.role}" in ${new URL(url).hostname}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
