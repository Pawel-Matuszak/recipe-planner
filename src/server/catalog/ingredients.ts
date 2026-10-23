// The shared product catalog. Any household member can add a product; only admins delete one.
import { norm } from "../../model";
import type { Tx } from "../db";
import { DomainError } from "../errors";

const OTHER = "Inne";

async function departmentId(tx: Tx, name: string): Promise<number> {
  const d = await tx.department.findUnique({ where: { name: name.trim() } })
    ?? await tx.department.findUnique({ where: { name: OTHER } })
    ?? await tx.department.create({ data: { name: OTHER, sortOrder: 99 } });
  return d.id;
}

/** The product's id, adding it to the catalog (in `dzial`, "Inne" by default) when it isn't there yet. */
export async function ensureIngredient(tx: Tx, name: string, dzial = OTHER): Promise<number> {
  const nameNorm = norm(name);
  if (!nameNorm) throw new DomainError("invalid", "Podaj nazwę składnika.");
  const found = await tx.ingredient.findUnique({ where: { nameNorm }, select: { id: true } });
  if (found) return found.id;
  const created = await tx.ingredient.upsert({
    where: { nameNorm },
    create: { name: name.trim(), nameNorm, departmentId: await departmentId(tx, dzial) },
    update: {},
    select: { id: true },
  });
  return created.id;
}

export const findIngredient = (tx: Tx, name: string) => tx.ingredient.findUnique({ where: { nameNorm: norm(name) } });

/** Deletes a product from the catalog (and every pantry). Refused while a recipe still uses it. */
export async function deleteIngredient(tx: Tx, name: string): Promise<void> {
  const ing = await findIngredient(tx, name);
  if (!ing) return;
  const used = await tx.recipeIngredient.findMany({ where: { ingredientId: ing.id }, select: { recipe: { select: { name: true } } }, distinct: ["recipeId"] });
  if (used.length) {
    const names = used.slice(0, 3).map(u => `„${u.recipe.name}”`).join(", ") + (used.length > 3 ? "…" : "");
    throw new DomainError("in_use", `„${ing.name}” jest w przepisach: ${names}. Najpierw usuń go z nich.`, 409);
  }
  await tx.ingredient.delete({ where: { id: ing.id } });
}
