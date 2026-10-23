// The one-off import of the real spreadsheet (scripts/import-sheet.ts): replaces the shared catalog with the
// sheet's recipes and products and loads its pantry, plan and shopping list into the owner's household.
// Accounts and households stay. Running it again replaces the same data, so it can be repeated until cutover.
import { buildModel, norm, shoppingItems, type Model, type Tables } from "../../model";
import type { Db, Tx } from "../db";
import { DomainError } from "../errors";
import { readState } from "../kitchen/state";
import { importModel, type ImportCounts } from "./fromModel";

/** The rows the sheet import replaces: the catalog and every household's kitchen. */
const REPLACED = [
  "household_recipe_state", "pantry_item", "plan_entry", "shopping_extra",
  "recipe_ingredient", "recipe_step", "recipe_link", "recipe_category", "recipe", "ingredient", "category", "recipe_type", "department",
];

/** Reads the Apps Script `action=all` answer (or a saved copy of it, or of its `data`). */
export function tablesOf(json: unknown): Tables {
  const j = json as { ok?: boolean; data?: unknown; error?: string; message?: string };
  if (j && typeof j === "object" && "error" in j) throw new Error(`Apps Script: ${j.error}${j.message ? ` (${j.message})` : ""}`);
  const t = (j && typeof j === "object" && "data" in j ? j.data : j) as Partial<Tables>;
  for (const k of ["main", "pantry", "plan", "extra"] as const) {
    if (!Array.isArray(t?.[k])) throw new Error(`Not a sheet export: "${k}" is missing.`);
  }
  return t as Tables;
}

export interface ImportResult { householdId: string; created: boolean; counts: ImportCounts }

/** Replaces the catalog and loads the sheet's kitchen into the household of `ownerEmail` (created if they have none). */
export async function importSheet(db: Db, m: Model, ownerEmail: string): Promise<ImportResult> {
  return db.$transaction(async tx => {
    const owner = await tx.user.findUnique({ where: { email: ownerEmail.trim().toLowerCase() }, include: { membership: true } });
    if (!owner) throw new DomainError("not_found", `No account for ${ownerEmail}. Sign up in the app first.`, 404);

    let householdId = owner.membership?.householdId;
    const created = !householdId;
    householdId ??= (await tx.household.create({ data: { name: "Dom", members: { create: { userId: owner.id, role: "owner" } } } })).id;

    // every household's state hangs off the catalog being replaced; only the owner's may exist yet
    const others = await otherKitchens(tx, householdId);
    if (others) throw new DomainError("conflict", `${others} other household(s) already have a pantry, plan or recipe notes; importing would erase them.`, 409);

    await tx.$executeRawUnsafe(`TRUNCATE ${REPLACED.map(t => `"${t}"`).join(", ")} RESTART IDENTITY`);
    const counts = await importModel(tx, m, { householdId, createdById: owner.id });
    return { householdId, created, counts };
  }, { timeout: 120_000, maxWait: 20_000 });
}

async function otherKitchens(tx: Tx, householdId: string): Promise<number> {
  const where = { householdId: { not: householdId } };
  const rows = await Promise.all([
    tx.pantryItem.findMany({ where, select: { householdId: true }, distinct: ["householdId"] }),
    tx.planEntry.findMany({ where, select: { householdId: true }, distinct: ["householdId"] }),
    tx.shoppingExtra.findMany({ where, select: { householdId: true }, distinct: ["householdId"] }),
    tx.householdRecipeState.findMany({ where, select: { householdId: true }, distinct: ["householdId"] }),
  ]);
  return new Set(rows.flat().map(r => r.householdId)).size;
}

/**
 * Compares what the app now shows the household with the sheet: the same recipes, products, plan and extras,
 * and the same shopping list for the current plan. Returns the differences (empty when the import is faithful).
 */
export async function verifyImport(db: Tx, householdId: string, sheet: Model): Promise<string[]> {
  const app = buildModel(await readState(db, householdId, { id: "", name: "", email: "", role: "user" }));
  const diffs: string[] = [];
  const same = (what: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${what}: sheet ${JSON.stringify(a)} ≠ app ${JSON.stringify(b)}`);
  };

  same("recipes", sheet.recipes.length, app.recipes.length);
  // the app's pantry is the whole catalog: the sheet's pantry plus products only recipes mention
  const catalog = new Set([...sheet.pantry.keys(), ...sheet.recipes.flatMap(r => r.ing.map(i => norm(i.name)))].filter(Boolean));
  same("products", catalog.size, app.pantry.size);
  const flags = (m: Model) => [...m.pantry.values()].filter(p => p.have || p.always).map(p => `${norm(p.name)}:${p.have}:${p.always}`).sort();
  same("pantry ticks", flags(sheet), flags(app));
  same("plan rows", sheet.plan.length, app.plan.length);
  same("extras", sheet.extra.map(x => `${x.item}:${x.bought}`), app.extra.map(x => `${x.item}:${x.bought}`));
  same("recipes done", sheet.recipes.filter(r => r.done).length, app.recipes.filter(r => r.done).length);

  const list = (m: Model) => shoppingItems(m).map(i => `${norm(i.name)}|${i.dzial}|${i.total}|${i.for.map(f => `${f.recipe}:${f.qty}`).sort().join(",")}`).sort();
  const want = list(sheet), got = list(app);
  for (const x of want.filter(x => !got.includes(x))) diffs.push(`shopping list: missing ${x}`);
  for (const x of got.filter(x => !want.includes(x))) diffs.push(`shopping list: extra ${x}`);
  return diffs;
}
