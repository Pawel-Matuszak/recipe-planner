// Global recipes, edited by admins.
import { parseIng, splitIng } from "../../model";
import type { Tx } from "../db";
import { DomainError } from "../errors";
import { ensureIngredient } from "./ingredients";

/** "12" → 12; anything else (a sheet id, junk) is a recipe that doesn't exist. */
export async function recipeIdOf(tx: Tx, id: string): Promise<number> {
  const n = /^\d+$/.test(id) ? Number(id) : NaN;
  if (Number.isSafeInteger(n) && await tx.recipe.findUnique({ where: { id: n }, select: { id: true } })) return n;
  throw new DomainError("not_found", "Tego przepisu już nie ma.", 404);
}

export interface RecipeEdit { desc?: string; steps?: string; ing?: string }

/** Omitted fields stay as they are. New ingredients become catalog products; saving ingredients marks them as checked. */
export async function editRecipe(tx: Tx, recipeId: number, e: RecipeEdit): Promise<void> {
  if (e.desc !== undefined) await tx.recipe.update({ where: { id: recipeId }, data: { description: e.desc.trim() } });
  if (e.steps !== undefined) {
    const steps = e.steps.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    await tx.recipeStep.deleteMany({ where: { recipeId } });
    await tx.recipeStep.createMany({ data: steps.map((text, position) => ({ recipeId, position, text })) });
  }
  if (e.ing !== undefined) {
    const ing = splitIng(e.ing).map(parseIng).filter(i => i.name);
    const rows = [];
    for (const [position, i] of ing.entries()) {
      rows.push({ recipeId, position, ingredientId: await ensureIngredient(tx, i.name), qtyText: i.qty?.raw || null });
    }
    await tx.recipeIngredient.deleteMany({ where: { recipeId } });
    await tx.recipeIngredient.createMany({ data: rows });
    await tx.recipe.update({ where: { id: recipeId }, data: { ingredientsVerified: true } });
  }
}
