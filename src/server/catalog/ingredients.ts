// The shared product catalog. Any household member can add a product; only admins delete one.
import { norm } from "../../model";
import type { Tx } from "../db";
import { DomainError } from "../errors";

const OTHER = "Inne";

/** The section's id; a blank name means "Inne". A section that isn't in the database is refused, not filed under "Inne". */
async function departmentId(tx: Tx, name: string): Promise<number> {
  const n = name.trim() || OTHER;
  const d = await tx.department.findUnique({ where: { name: n } })
    ?? (n === OTHER ? await tx.department.create({ data: { name: OTHER, sortOrder: 99 } }) : null);
  if (!d) throw new DomainError("invalid", `Nie ma działu „${n}”. Wybierz dział z listy.`);
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

/** Renames a product or moves it to another section. A name another product already has is refused: merge them instead. */
export async function editIngredient(tx: Tx, name: string, e: { newName?: string; dzial?: string }): Promise<void> {
  const ing = await findIngredient(tx, name);
  if (!ing) throw new DomainError("not_found", `Nie ma już „${name.trim()}” w bazie.`, 404);
  const newName = e.newName?.trim();
  if (newName && norm(newName) !== ing.nameNorm && await findIngredient(tx, newName)) {
    throw new DomainError("exists", `„${newName}” już jest w bazie. Połącz te składniki zamiast zmieniać nazwę.`, 409);
  }
  await tx.ingredient.update({
    where: { id: ing.id },
    data: {
      ...(newName && { name: newName, nameNorm: norm(newName) }),
      ...(e.dzial && { departmentId: await departmentId(tx, e.dzial) }),
    },
  });
}

/**
 * Folds `from` into `into`: recipes that used `from` use `into`, and each household keeps "mam" / "zawsze mam"
 * if it had it on either. Then `from` is deleted. Merging a product into itself, or one that's already gone, does nothing.
 */
export async function mergeIngredients(tx: Tx, fromName: string, intoName: string): Promise<void> {
  const [from, into] = [await findIngredient(tx, fromName), await findIngredient(tx, intoName)];
  if (!into) throw new DomainError("not_found", `Nie ma „${intoName.trim()}” w bazie.`, 404);
  if (!from || from.id === into.id) return;

  await tx.recipeIngredient.updateMany({ where: { ingredientId: from.id }, data: { ingredientId: into.id } });
  for (const p of await tx.pantryItem.findMany({ where: { ingredientId: from.id } })) {
    await tx.pantryItem.upsert({
      where: { householdId_ingredientId: { householdId: p.householdId, ingredientId: into.id } },
      create: { householdId: p.householdId, ingredientId: into.id, have: p.have, always: p.always },
      update: { ...(p.have && { have: true }), ...(p.always && { always: true }) },
    });
  }
  await tx.ingredient.delete({ where: { id: from.id } }); // its pantry rows go with it
}
