// Write side: applies one action from the app's queue (POST /api/actions) to the caller's household.
// Mirrors applyAction in src/actions.ts, which does the same to the phone's copy. Every action can be sent twice
// (a retry after a lost answer) without changing the result: new rows carry ids made on the phone.
import { norm } from "../../model";
import type { Action } from "../../actions";
import { deleteIngredient, ensureIngredient, findIngredient } from "../catalog/ingredients";
import { editRecipe, recipeIdOf } from "../catalog/recipes";
import type { Tx } from "../db";
import { DomainError, forbidden } from "../errors";
import type { SessionUser } from "../identity/auth";

export interface Ctx { householdId: string; user: SessionUser }

const requireAdmin = (ctx: Ctx) => { if (ctx.user.role !== "admin") throw forbidden(); };

async function setHave(tx: Tx, householdId: string, ingredientId: number, have: boolean) {
  await tx.pantryItem.upsert({
    where: { householdId_ingredientId: { householdId, ingredientId } },
    create: { householdId, ingredientId, have },
    update: { have },
  });
}

export async function runAction(tx: Tx, ctx: Ctx, a: Action): Promise<void> {
  const { householdId } = ctx;
  switch (a.action) {
    case "setRecipeField": {
      const recipeId = await recipeIdOf(tx, a.recipeId);
      const data = a.field === "done" ? { done: a.value } : a.field === "rate" ? { rating: a.value || null } : { notes: a.value };
      await tx.householdRecipeState.upsert({
        where: { householdId_recipeId: { householdId, recipeId } },
        create: { householdId, recipeId, ...data },
        update: data,
      });
      return;
    }
    case "editRecipe": {
      requireAdmin(ctx);
      return editRecipe(tx, await recipeIdOf(tx, a.recipeId), a);
    }
    case "setPantry":
      return setHave(tx, householdId, await ensureIngredient(tx, a.name), a.have);
    case "addPantry": {
      const have = a.have !== false;
      const existing = await findIngredient(tx, a.name);
      if (existing && !have) return;
      return setHave(tx, householdId, existing?.id ?? await ensureIngredient(tx, a.name, a.dzial), have);
    }
    case "removePantry":
      requireAdmin(ctx);
      return deleteIngredient(tx, a.name);
    case "addPlan": {
      const recipeId = a.id ? await recipeIdOf(tx, a.id) : null;
      const text = a.text.trim() || null;
      if (!recipeId && !text) throw new DomainError("invalid", "Podaj danie.");
      await tx.planEntry.createMany({
        data: [{ id: a.uid, householdId, recipeId, text, meal: a.meal, plannedOn: new Date(`${a.date}T00:00:00Z`) }],
        skipDuplicates: true,
      });
      return;
    }
    case "removePlan":
      await tx.planEntry.deleteMany({ where: { id: a.uid, householdId } });
      return;
    case "setCooked":
      await tx.planEntry.updateMany({ where: { id: a.uid, householdId }, data: { cooked: a.cooked } });
      return;
    case "addExtra": {
      // an item already open on the list isn't added twice
      const open = new Set((await tx.shoppingExtra.findMany({ where: { householdId, bought: false }, select: { item: true } })).map(x => norm(x.item)));
      const data = [], t0 = Date.now();
      for (const { uid, item } of a.items) {
        if (open.has(norm(item))) continue;
        open.add(norm(item));
        data.push({ id: uid, householdId, item: item.trim(), createdAt: new Date(t0 + data.length) }); // keeps the order they were added in
      }
      await tx.shoppingExtra.createMany({ data, skipDuplicates: true });
      return;
    }
    case "setExtra":
      await tx.shoppingExtra.updateMany({ where: { id: a.uid, householdId }, data: { bought: a.bought } });
      return;
    case "removeExtra":
      await tx.shoppingExtra.deleteMany({ where: { householdId, bought: false, item: { equals: a.item.trim(), mode: "insensitive" } } });
      return;
    case "clearBoughtExtra":
      await tx.shoppingExtra.deleteMany({ where: { householdId, bought: true } });
      return;
  }
}
