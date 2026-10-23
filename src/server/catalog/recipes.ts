// Global recipes, edited by admins.
import type { Action } from "../../actions";
import type { Difficulty } from "../../generated/prisma/enums";
import { norm, parseIng, splitIng } from "../../model";
import type { Tx } from "../db";
import { DomainError } from "../errors";
import { ensureIngredient } from "./ingredients";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A recipe's id in the app: the phone's id for recipes made in the app, the database id ("12") for the rest. */
export const publicId = (r: { id: number; clientId: string | null }) => r.clientId ?? String(r.id);

/** The database id for an id from the app; anything else (a sheet id, junk) is a recipe that doesn't exist. */
export async function recipeIdOf(tx: Tx, id: string): Promise<number> {
  const where = /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) ? { id: Number(id) } : UUID.test(id) ? { clientId: id.toLowerCase() } : null;
  const found = where && await tx.recipe.findUnique({ where, select: { id: true } });
  if (found) return found.id;
  throw new DomainError("not_found", "Tego przepisu już nie ma.", 404);
}

const DIFFICULTY: Record<string, Difficulty> = { "Łatwy": "easy", "Średni": "medium", "Trudny": "hard" };

export type RecipeEdit = Omit<Extract<Action, { action: "editRecipe" }>, "action" | "recipeId">;
type RecipeData = Omit<Extract<Action, { action: "createRecipe" }>, "action" | "recipeId">;

const uniq = (xs: string[]) => [...new Set(xs.map(x => x.trim()).filter(Boolean))];
const typeId = async (tx: Tx, name: string) => (await tx.recipeType.upsert({ where: { name: name.trim() }, create: { name: name.trim() }, update: {} })).id;

/** Adds a recipe under the id the phone gave it. Repeating the same request changes nothing. */
export async function createRecipe(tx: Tx, clientId: string, d: RecipeData, createdById: string): Promise<void> {
  const exists = await tx.recipe.findUnique({ where: { clientId: clientId.toLowerCase() }, select: { id: true } });
  if (exists) return;
  const { id } = await tx.recipe.create({
    data: { clientId: clientId.toLowerCase(), name: d.name.trim(), typeId: await typeId(tx, d.type), createdById },
    select: { id: true },
  });
  await editRecipe(tx, id, d);
}

/** Omitted fields stay as they are. New ingredients become catalog products; saving ingredients marks them as checked. */
export async function editRecipe(tx: Tx, recipeId: number, e: RecipeEdit): Promise<void> {
  await tx.recipe.update({
    where: { id: recipeId },
    data: {
      ...(e.name !== undefined && { name: e.name.trim() }),
      ...(e.type !== undefined && { typeId: await typeId(tx, e.type) }),
      ...(e.diff !== undefined && { difficulty: DIFFICULTY[e.diff] ?? null }),
      ...(e.time !== undefined && { timeMin: e.time || null }),
      ...(e.arch !== undefined && { archived: e.arch }),
      ...(e.desc !== undefined && { description: e.desc.trim() }),
      ...(e.ing !== undefined && { ingredientsVerified: true }),
    },
  });
  if (e.cats !== undefined) {
    const ids = [];
    for (const name of uniq(e.cats)) ids.push((await tx.category.upsert({ where: { name }, create: { name }, update: {} })).id);
    await tx.recipeCategory.deleteMany({ where: { recipeId } });
    await tx.recipeCategory.createMany({ data: ids.map(categoryId => ({ recipeId, categoryId })) });
  }
  if (e.links !== undefined) {
    await tx.recipeLink.deleteMany({ where: { recipeId } });
    await tx.recipeLink.createMany({ data: uniq(e.links).map((url, position) => ({ recipeId, position, url })) });
  }
  if (e.steps !== undefined) {
    const steps = e.steps.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    await tx.recipeStep.deleteMany({ where: { recipeId } });
    await tx.recipeStep.createMany({ data: steps.map((text, position) => ({ recipeId, position, text })) });
  }
  if (e.ing !== undefined) {
    const ing = splitIng(e.ing).map(parseIng).filter(i => norm(i.name));
    const rows = [];
    for (const [position, i] of ing.entries()) {
      rows.push({ recipeId, position, ingredientId: await ensureIngredient(tx, i.name), qtyText: i.qty?.raw || null });
    }
    await tx.recipeIngredient.deleteMany({ where: { recipeId } });
    await tx.recipeIngredient.createMany({ data: rows });
  }
}
