// Read side: everything the app shows for one household, in one snapshot (GET /api/state).
import type { State } from "../../model";
import type { Tx } from "../db";
import { publicId } from "../catalog/recipes";
import type { SessionUser } from "../identity/auth";

export const DIFFICULTY_LABEL = { easy: "Łatwy", medium: "Średni", hard: "Trudny" } as const;

export async function readState(db: Tx, householdId: string, user: SessionUser): Promise<State> {
  const [recipes, ingredients, plan, extra] = await Promise.all([
    db.recipe.findMany({
      orderBy: { name: "asc" },
      include: {
        type: true,
        categories: { include: { category: true } },
        links: { orderBy: { position: "asc" } },
        steps: { orderBy: { position: "asc" } },
        ingredients: { orderBy: { position: "asc" }, include: { ingredient: true } },
        state: { where: { householdId } },
      },
    }),
    db.ingredient.findMany({ include: { department: true, pantry: { where: { householdId } } } }),
    db.planEntry.findMany({ where: { householdId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    db.shoppingExtra.findMany({ where: { householdId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
  ]);

  const recipeKey = new Map(recipes.map(r => [r.id, publicId(r)]));
  return {
    me: { name: user.name, role: user.role },
    recipes: recipes.map(r => {
      const own = r.state[0];
      return {
        id: publicId(r), name: r.name, type: r.type.name, diff: r.difficulty ? DIFFICULTY_LABEL[r.difficulty] : "",
        done: own?.done ?? false, arch: r.archived, links: r.links.map(l => l.url), cats: r.categories.map(c => c.category.name),
        time: r.timeMin ?? 0, ing: r.ingredients.map(i => ({ name: i.ingredient.name, qty: i.qtyText, ...(i.section && { sec: i.section }), ...(i.note && { note: i.note }) })), ver: r.ingredientsVerified,
        rate: own?.rating ?? 0, notes: own?.notes ?? "", desc: r.description, steps: r.steps.map(s => s.text),
      };
    }),
    pantry: ingredients.map(i => ({ name: i.name, dzial: i.department.name, have: i.pantry[0]?.have ?? false, always: i.pantry[0]?.always ?? false })),
    plan: plan.map(p => ({
      uid: p.id, date: p.plannedOn ? p.plannedOn.toISOString().slice(0, 10) : p.createdAt.toISOString().slice(0, 10),
      meal: p.meal, id: p.recipeId ? recipeKey.get(p.recipeId) ?? "" : "", text: p.text ?? "", cooked: p.cooked,
    })),
    extra: extra.map(x => ({ uid: x.id, item: x.item, bought: x.bought })),
  };
}
