// Write actions shared by the client (optimistic update + sync queue), the demo backend and the server
// (POST /api/actions validates with `ActionSchema`, then src/server/kitchen/actions.ts applies the same change in the database).
import { z } from "zod";
import { newId, norm, parseIng, splitIng, type State } from "./model";

const name = z.string().trim().min(1).max(120);
const uid = z.uuid();

const recipeField = { action: z.literal("setRecipeField"), recipeId: z.string() };

/** What an admin can set on a recipe. Ingredients are "name: amount; …"; steps one per line. */
export const DIFFICULTIES = ["Łatwy", "Średni", "Trudny"] as const;
const recipeData = {
  name: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(60),
  diff: z.enum(["", ...DIFFICULTIES]),
  time: z.number().int().min(0).max(10_000),
  cats: z.array(z.string().trim().min(1).max(60)).max(10),
  links: z.array(z.string().trim().min(1).max(2000)).max(10),
  desc: z.string().max(5000),
  steps: z.string().max(20000),
  ing: z.string().max(5000),
  arch: z.boolean(),
};
const recipeDataPartial = z.object(recipeData).partial().shape;

export const ActionSchema = z.discriminatedUnion("action", [
  // the household's own "Było robione" / "Ocena" ("" clears it) / "Notatki"
  z.discriminatedUnion("field", [
    z.object({ ...recipeField, field: z.literal("done"), value: z.boolean() }),
    z.object({ ...recipeField, field: z.literal("rate"), value: z.union([z.number().int().min(1).max(5), z.literal("")]) }),
    z.object({ ...recipeField, field: z.literal("notes"), value: z.string().max(5000) }),
  ]),
  // admin only. `recipeId` is made on the phone, so the recipe can be planned or edited before it reaches the server
  z.object({ action: z.literal("createRecipe"), recipeId: uid, ...recipeData }),
  // admin only. Omitted fields stay as they are; sending `ing` also marks the ingredients as checked
  z.object({ action: z.literal("editRecipe"), recipeId: z.string(), ...recipeDataPartial }),
  // a name missing from the catalog becomes a new product (in "Inne" unless `dzial` says otherwise)
  z.object({ action: z.literal("setPantry"), name, have: z.boolean() }),
  // `have` defaults to true; a new product added from the recipe editor goes in as "nie mam"
  z.object({ action: z.literal("addPantry"), name, dzial: z.string().max(80), have: z.boolean().optional() }),
  // admin only: deletes the product from the shared catalog (refused while a recipe uses it)
  z.object({ action: z.literal("removePantry"), name }),
  // admin only: renames a product or moves it to another section (a name already in the catalog needs mergeIngredients)
  z.object({ action: z.literal("editIngredient"), name, newName: name.optional(), dzial: z.string().trim().min(1).max(80).optional() }),
  // admin only: `from` disappears; its recipes use `into`, and a household that had either has `into`
  z.object({ action: z.literal("mergeIngredients"), from: name, into: name }),
  z.object({ action: z.literal("addPlan"), uid, date: z.iso.date(), meal: z.string().max(40), id: z.string().max(40), text: z.string().max(200) }),
  z.object({ action: z.literal("removePlan"), uid }),
  z.object({ action: z.literal("setCooked"), uid, cooked: z.boolean() }),
  z.object({ action: z.literal("addExtra"), items: z.array(z.object({ uid, item: name })).max(100) }),
  z.object({ action: z.literal("setExtra"), uid, bought: z.boolean() }),
  z.object({ action: z.literal("removeExtra"), item: name }),
  z.object({ action: z.literal("clearBoughtExtra") }),
]);

export type Action = z.infer<typeof ActionSchema>;
export type RecipeField = Extract<Action, { action: "setRecipeField" }>["field"];

/** Shopping-list items for `addExtra`, each with a fresh id. */
export const extraItems = (...items: string[]) => items.map(item => ({ uid: newId(), item }));

/** Applies an action to the state in place, mirroring what the server does. */
export function applyAction(s: State, a: Action): void {
  switch (a.action) {
    case "setRecipeField": {
      const r = s.recipes.find(x => x.id === a.recipeId);
      if (!r) return;
      if (a.field === "done") r.done = a.value;
      if (a.field === "rate") r.rate = a.value || 0;
      if (a.field === "notes") r.notes = a.value;
      return;
    }
    case "createRecipe": {
      if (s.recipes.some(x => x.id === a.recipeId)) return;
      const { action: _, recipeId, ...data } = a;
      s.recipes.push({ id: recipeId, name: "", type: "", diff: "", done: false, arch: false, links: [], cats: [], time: 0, ing: [], ver: false, rate: 0, notes: "", desc: "", steps: [] });
      applyAction(s, { ...data, action: "editRecipe", recipeId });
      return;
    }
    case "editRecipe": {
      const r = s.recipes.find(x => x.id === a.recipeId);
      if (!r) return;
      if (a.name !== undefined) r.name = a.name.trim();
      if (a.type !== undefined) r.type = a.type.trim();
      if (a.diff !== undefined) r.diff = a.diff;
      if (a.time !== undefined) r.time = a.time;
      if (a.cats !== undefined) r.cats = uniq(a.cats);
      if (a.links !== undefined) r.links = uniq(a.links);
      if (a.arch !== undefined) r.arch = a.arch;
      if (a.desc !== undefined) r.desc = a.desc.trim();
      if (a.steps !== undefined) r.steps = a.steps.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      if (a.ing !== undefined) {
        r.ing = splitIng(a.ing).map(parseIng).filter(i => norm(i.name)).map(i => ({ name: catalogName(s, i.name), qty: i.qty?.raw || null }));
        r.ver = true;
        for (const i of r.ing) addProduct(s, i.name, "Inne", false);
      }
      return;
    }
    case "setPantry": {
      const p = s.pantry.find(x => norm(x.name) === norm(a.name));
      if (p) p.have = a.have;
      else s.pantry.push({ name: a.name.trim(), dzial: "Inne", have: a.have, always: false });
      return;
    }
    case "addPantry": {
      const have = a.have !== false;
      const p = s.pantry.find(x => norm(x.name) === norm(a.name));
      if (p) { if (have) p.have = true; }
      else addProduct(s, a.name, a.dzial, have);
      return;
    }
    case "removePantry":
      s.pantry = s.pantry.filter(x => norm(x.name) !== norm(a.name));
      return;
    case "editIngredient": {
      const p = s.pantry.find(x => norm(x.name) === norm(a.name));
      const to = a.newName?.trim();
      if (!p || (to && norm(to) !== norm(p.name) && s.pantry.some(x => norm(x.name) === norm(to)))) return; // the server refuses a taken name
      if (a.dzial) p.dzial = a.dzial.trim();
      if (!to || to === p.name) return;
      for (const r of s.recipes) for (const i of r.ing) if (norm(i.name) === norm(p.name)) i.name = to;
      p.name = to;
      return;
    }
    case "mergeIngredients": {
      const from = s.pantry.find(x => norm(x.name) === norm(a.from)), into = s.pantry.find(x => norm(x.name) === norm(a.into));
      if (!from || !into || from === into) return;
      into.have ||= from.have;
      into.always ||= from.always;
      for (const r of s.recipes) for (const i of r.ing) if (norm(i.name) === norm(from.name)) i.name = into.name;
      s.pantry = s.pantry.filter(x => x !== from);
      return;
    }
    case "addPlan":
      if (!s.plan.some(p => p.uid === a.uid)) s.plan.push({ uid: a.uid, date: a.date, meal: a.meal, id: a.id, text: a.text, cooked: false });
      return;
    case "removePlan":
      s.plan = s.plan.filter(p => p.uid !== a.uid);
      return;
    case "setCooked": {
      const p = s.plan.find(x => x.uid === a.uid);
      if (p) p.cooked = a.cooked;
      return;
    }
    case "addExtra": {
      const open = new Set(s.extra.filter(x => !x.bought).map(x => norm(x.item)));
      for (const { uid, item } of a.items) {
        if (open.has(norm(item)) || s.extra.some(x => x.uid === uid)) continue;
        s.extra.push({ uid, item: item.trim(), bought: false });
        open.add(norm(item));
      }
      return;
    }
    case "setExtra": {
      const x = s.extra.find(e => e.uid === a.uid);
      if (x) x.bought = a.bought;
      return;
    }
    case "removeExtra":
      s.extra = s.extra.filter(x => x.bought || norm(x.item) !== norm(a.item));
      return;
    case "clearBoughtExtra":
      s.extra = s.extra.filter(x => !x.bought);
      return;
  }
}

/** The catalog's spelling of a product ("Pomidory" → "pomidory"), or the name as typed when it's new. */
const catalogName = (s: State, n: string) => s.pantry.find(p => norm(p.name) === norm(n))?.name ?? n.trim();

function addProduct(s: State, n: string, dzial: string, have: boolean) {
  if (!norm(n) || s.pantry.some(p => norm(p.name) === norm(n))) return;
  s.pantry.push({ name: n.trim(), dzial: dzial || "Inne", have, always: false });
}

const uniq = (xs: string[]) => [...new Set(xs.map(x => x.trim()).filter(Boolean))];

export const cloneState = (s: State): State => structuredClone(s);
