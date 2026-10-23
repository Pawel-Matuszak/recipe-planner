// One-off import of the "Obiadki2" spreadsheet into the database (phase 5 / cutover).
//
//   npx tsx scripts/import-sheet.ts [--file export.json]                 report only: what to fix in the sheet first
//   npx tsx scripts/import-sheet.ts --owner you@example.com --apply      replace the catalog and load your kitchen
//
// Source: --file (a saved `?action=all` answer), else the Apps Script web app at SHEET_URL with SHEET_TOKEN.
// Target: DIRECT_URL / DATABASE_URL (from .env.local unless set). The owner must have signed up already.
// Anything but localhost also needs --host <hostname>, so the target is always named on purpose.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseSheet, type Tables } from "../src/model";
import { createDb } from "../src/server/db";
import { sheetReport } from "../src/server/import/report";
import { importSheet, tablesOf, verifyImport } from "../src/server/import/sheet";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { values: args } = parseArgs({
  options: {
    file: { type: "string" }, save: { type: "string" }, owner: { type: "string" },
    apply: { type: "boolean", default: false }, host: { type: "string" },
  },
});

async function loadTables(): Promise<Tables> {
  if (args.file) return tablesOf(JSON.parse(readFileSync(args.file, "utf8")));
  const url = process.env.SHEET_URL, token = process.env.SHEET_TOKEN;
  if (!url || !token) throw new Error("Pass --file, or set SHEET_URL and SHEET_TOKEN (the Apps Script web app and its API_TOKEN).");
  const res = await fetch(`${url}?action=all&token=${encodeURIComponent(token)}`, { redirect: "follow" });
  if (!res.ok) throw new Error(`Apps Script answered ${res.status}`);
  const json = await res.json();
  const t = tablesOf(json);
  if (args.save) writeFileSync(args.save, JSON.stringify(json));
  return t;
}

async function main() {
  const tables = await loadTables();
  const model = parseSheet(tables);
  const { errors, warnings } = sheetReport(tables, model);

  console.log(`Sheet: ${model.recipes.length} recipes, ${model.pantry.size} pantry products, ${model.plan.length} plan rows, ${model.extra.length} extras.`);
  for (const w of warnings) console.log(`  warning  ${w}`);
  for (const e of errors) console.log(`  ERROR    ${e}`);
  if (!warnings.length && !errors.length) console.log("  nothing to fix");
  if (!args.apply) return console.log("\nReport only. Add --owner <email> --apply to import.");
  if (errors.length) throw new Error("Fix the errors in the sheet first.");
  if (!args.owner) throw new Error("--apply needs --owner <email> (whose household gets the pantry, plan and extras).");

  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL is not set");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "postgres"].includes(host) && args.host !== host) {
    throw new Error(`This replaces all recipes and products on ${host}. Run again with --host ${host} if that's intended.`);
  }

  const db = createDb(url);
  try {
    const { householdId, created, counts } = await importSheet(db, model, args.owner);
    console.log(`\nImported into ${host}${created ? " (new household \"Dom\")" : ""}:`, counts);
    const diffs = await verifyImport(db, householdId, model);
    if (diffs.length) {
      for (const d of diffs) console.log(`  MISMATCH ${d}`);
      throw new Error("The imported data doesn't match the sheet.");
    }
    console.log("Checked: recipes, products, pantry ticks, plan, extras and the shopping list match the sheet.");
  } finally {
    await db.$disconnect();
  }
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
