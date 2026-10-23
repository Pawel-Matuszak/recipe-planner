import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { demoTables } from "../../mock";
import { norm, parseSheet } from "../../model";
import { createDb, truncateAll } from "../db";
import { importModel } from "./fromModel";

const db = createDb();
const model = parseSheet(demoTables());

async function seedDemo() {
  await db.user.create({ data: { id: "u1", name: "Ania", email: "ania@example.com" } });
  const h = await db.household.create({ data: { name: "Dom", members: { create: { userId: "u1", role: "owner" } } } });
  const counts = await db.$transaction(tx => importModel(tx, model, { householdId: h.id, createdById: "u1" }));
  return { householdId: h.id, counts };
}

beforeEach(() => truncateAll(db));
afterAll(() => db.$disconnect());

describe("importModel", () => {
  it("loads every recipe, ingredient and pantry row of the demo sheet", async () => {
    const { counts } = await seedDemo();
    const names = new Set([...model.pantry.keys(), ...model.recipes.flatMap(r => r.ing.map(i => norm(i.name)))]);
    expect(counts).toMatchObject({
      recipes: model.recipes.length, ingredients: names.size, pantry: model.pantry.size,
      plan: model.plan.length, extras: model.extra.length,
      recipeIngredients: model.recipes.reduce((n, r) => n + r.ing.length, 0),
    });
    expect(await db.recipe.count()).toBe(model.recipes.length);
  });

  it("keeps a recipe's ingredients, amounts, steps and links in order", async () => {
    await seedDemo();
    const r = await db.recipe.findUniqueOrThrow({
      where: { legacyId: "r001" },
      include: {
        type: true, categories: { include: { category: true } }, links: true,
        steps: { orderBy: { position: "asc" } }, ingredients: { orderBy: { position: "asc" }, include: { ingredient: true } },
      },
    });
    expect(r).toMatchObject({ name: "Carbonara", difficulty: "medium", timeMin: 20, type: { name: "Danie główne" } });
    expect(r.categories.map(c => c.category.name)).toEqual(["Makaron"]);
    expect(r.ingredients.map(i => [i.ingredient.name, i.qtyText])).toEqual([
      ["makaron", "200 g"], ["boczek", "150 g"], ["jajka", "3"], ["parmezan", "50 g"], ["pieprz", null],
    ]);
    expect(r.steps).toHaveLength(4);
    expect(r.links.map(l => l.url)).toEqual(["https://www.youtube.com/watch?v=qoHnwOHLiMk"]);
  });

  it("puts the household's own state (done, rating, pantry, plan) on the household", async () => {
    const { householdId } = await seedDemo();
    const carbonara = await db.recipe.findUniqueOrThrow({ where: { legacyId: "r001" } });
    expect(await db.householdRecipeState.findUnique({ where: { householdId_recipeId: { householdId, recipeId: carbonara.id } } }))
      .toMatchObject({ done: true, rating: 5 });
    const pepper = await db.pantryItem.findFirstOrThrow({ where: { householdId, ingredient: { nameNorm: "pieprz" } }, include: { ingredient: { include: { department: true } } } });
    expect(pepper).toMatchObject({ have: false, always: true, ingredient: { department: { name: "Sosy i przyprawy" } } });
    const plan = await db.planEntry.findMany({ where: { householdId }, include: { recipe: true } });
    expect(plan.map(p => p.recipe?.legacyId ?? p.text).sort()).toEqual(["kanapki z szynką", "r001", "r002", "r005", "r008"]);
  });
});

describe("schema rules", () => {
  it("rejects a rating outside 1–5 and a plan entry with neither recipe nor text", async () => {
    const { householdId } = await seedDemo();
    const recipe = await db.recipe.findFirstOrThrow({ where: { legacyId: "r003" } });
    await expect(db.householdRecipeState.create({ data: { householdId, recipeId: recipe.id, rating: 6 } })).rejects.toThrow();
    await expect(db.planEntry.create({ data: { id: randomUUID(), householdId, text: "  " } })).rejects.toThrow();
  });

  it("rejects an ingredient whose normalized name doesn't match its name", async () => {
    const dept = await db.department.create({ data: { name: "Inne", sortOrder: 0 } });
    await expect(db.ingredient.create({ data: { name: "Masło", nameNorm: "maslo", departmentId: dept.id } })).rejects.toThrow();
    await expect(db.ingredient.create({ data: { name: "Masło", nameNorm: "masło", departmentId: dept.id } })).resolves.toBeTruthy();
  });

  it("deleting a household removes its kitchen but keeps the shared catalog", async () => {
    const { householdId } = await seedDemo();
    await db.household.delete({ where: { id: householdId } });
    expect(await db.pantryItem.count()).toBe(0);
    expect(await db.planEntry.count()).toBe(0);
    expect(await db.householdRecipeState.count()).toBe(0);
    expect(await db.recipe.count()).toBe(model.recipes.length);
    expect(await db.ingredient.count()).toBeGreaterThan(0);
  });
});
