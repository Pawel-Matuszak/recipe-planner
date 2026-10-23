// Loads a sheet-shaped Model (from parseSheet) into empty tables: the global catalog plus one household's
// kitchen. Used by the demo seed and by the one-off import of the real spreadsheet.
import { randomUUID } from "node:crypto";
import type { Difficulty } from "../../generated/prisma/enums";
import { DZIALY, norm, type Model } from "../../model";
import type { Tx } from "../db";

const DIFFICULTY: Record<string, Difficulty> = { "łatwy": "easy", "średni": "medium", "trudny": "hard" };

export interface ImportTarget { householdId: string; createdById: string | null }

export interface ImportCounts {
  departments: number; ingredients: number; recipeTypes: number; categories: number; recipes: number;
  recipeIngredients: number; recipeState: number; pantry: number; plan: number; extras: number;
}

export async function importModel(tx: Tx, m: Model, to: ImportTarget): Promise<ImportCounts> {
  const pantry = [...m.pantry.values()];

  // departments: the known order first, then any other names found in the pantry
  const deptNames = [...new Set([...DZIALY, ...pantry.map(p => p.dzial)])];
  const departments = await tx.department.createManyAndReturn({ data: deptNames.map((name, i) => ({ name, sortOrder: i })) });
  const deptId = new Map(departments.map(d => [d.name, d.id]));
  const other = deptId.get("Inne")!;

  // ingredients: one per normalized name; the pantry's spelling and section win over a recipe's
  const ingredients = new Map<string, { name: string; departmentId: number }>();
  for (const p of pantry) ingredients.set(norm(p.name), { name: p.name.trim(), departmentId: deptId.get(p.dzial) ?? other });
  for (const r of m.recipes) for (const i of r.ing) if (norm(i.name) && !ingredients.has(norm(i.name))) ingredients.set(norm(i.name), { name: i.name.trim(), departmentId: other });
  const ingRows = await tx.ingredient.createManyAndReturn({ data: [...ingredients].map(([nameNorm, v]) => ({ ...v, nameNorm })) });
  const ingId = new Map(ingRows.map(i => [i.nameNorm, i.id]));

  const types = await tx.recipeType.createManyAndReturn({ data: [...new Set(m.recipes.map(r => r.type))].map(name => ({ name })) });
  const typeId = new Map(types.map(t => [t.name, t.id]));
  const cats = await tx.category.createManyAndReturn({ data: [...new Set(m.recipes.flatMap(r => r.cats))].map(name => ({ name })) });
  const catId = new Map(cats.map(c => [c.name, c.id]));

  // recipes keep their sheet ID so plan rows can find them; "#Name" ids (rows without an ID) have no legacy id
  const recipeId = new Map<string, number>();
  let recipeIngredients = 0, recipeState = 0;
  for (const r of m.recipes) {
    const ing = r.ing.filter(i => norm(i.name));
    const created = await tx.recipe.create({
      data: {
        legacyId: r.id.startsWith("#") ? null : r.id,
        name: r.name, typeId: typeId.get(r.type)!, difficulty: DIFFICULTY[norm(r.diff)] ?? null, timeMin: r.time || null,
        description: r.desc, archived: r.arch, ingredientsVerified: r.ver, createdById: to.createdById,
        categories: { create: [...new Set(r.cats)].map(c => ({ categoryId: catId.get(c)! })) },
        links: { create: r.links.map((url, position) => ({ position, url })) },
        steps: { create: r.steps.map((text, position) => ({ position, text })) },
        ingredients: { create: ing.map((i, position) => ({ position, ingredientId: ingId.get(norm(i.name))!, qtyText: i.qty?.raw ?? null })) },
      },
    });
    recipeId.set(r.id, created.id);
    recipeIngredients += ing.length;
    if (r.done || r.rate || r.notes) {
      await tx.householdRecipeState.create({
        data: { householdId: to.householdId, recipeId: created.id, done: r.done, rating: r.rate >= 1 && r.rate <= 5 ? r.rate : null, notes: r.notes },
      });
      recipeState++;
    }
  }

  const pantryRows = await tx.pantryItem.createMany({
    data: pantry.map(p => ({ householdId: to.householdId, ingredientId: ingId.get(norm(p.name))!, have: p.have, always: p.always })),
  });

  // rows inserted together would share one created_at, which is what the app sorts by: space them 1 ms apart
  const t0 = Date.now(), at = (i: number) => new Date(t0 + i);

  // plan rows pointing at a recipe that no longer exists keep their text so nothing is lost
  const plan = m.plan.map((p, i) => {
    const rid = p.id ? recipeId.get(p.id) : undefined;
    const text = rid ? p.text || null : p.text || p.id || null;
    return { id: randomUUID(), householdId: to.householdId, recipeId: rid ?? null, text, meal: p.meal, plannedOn: new Date(`${p.date}T00:00:00Z`), cooked: p.cooked, createdAt: at(i) };
  }).filter(p => p.recipeId || p.text);
  await tx.planEntry.createMany({ data: plan });

  const extras = await tx.shoppingExtra.createMany({ data: m.extra.map((x, i) => ({ id: randomUUID(), householdId: to.householdId, item: x.item, bought: x.bought, createdAt: at(i) })) });

  return {
    departments: departments.length, ingredients: ingRows.length, recipeTypes: types.length, categories: cats.length,
    recipes: m.recipes.length, recipeIngredients, recipeState, pantry: pantryRows.count, plan: plan.length, extras: extras.count,
  };
}
