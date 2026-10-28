import { describe, expect, it } from "vitest";
import { ActionSchema, applyAction, extraItems } from "./actions";
import { demoState } from "./mock";
import { buildModel, ingState } from "./model";

const uid = () => crypto.randomUUID();

describe("applyAction", () => {
  it("sets the household's done, rating and notes on a recipe", () => {
    const s = demoState();
    applyAction(s, { action: "setRecipeField", recipeId: "r005", field: "done", value: true });
    applyAction(s, { action: "setRecipeField", recipeId: "r001", field: "rate", value: 4 });
    applyAction(s, { action: "setRecipeField", recipeId: "r002", field: "notes", value: "mniej soli" });
    const get = (id: string) => s.recipes.find(r => r.id === id)!;
    expect(get("r005").done).toBe(true);
    expect(get("r001").rate).toBe(4);
    expect(get("r002").notes).toBe("mniej soli");
  });

  it("clears the rating with an empty value", () => {
    const s = demoState();
    applyAction(s, { action: "setRecipeField", recipeId: "r001", field: "rate", value: "" });
    expect(s.recipes.find(r => r.id === "r001")!.rate).toBe(0);
  });

  it("edits description, steps and ingredients, marking ingredients as checked and using catalog spelling", () => {
    const s = demoState();
    applyAction(s, { action: "editRecipe", recipeId: "r002", desc: "Nowy opis", steps: "Krok 1\nKrok 2", ing: "Papryka: 2; cebula; szafran: szczypta" });
    const r = buildModel(s).recipes.find(x => x.id === "r002")!;
    expect(r.desc).toBe("Nowy opis");
    expect(r.steps).toEqual([{ text: "Krok 1" }, { text: "Krok 2" }]);
    expect(r.ing.map(i => [i.name, i.qty?.raw ?? null])).toEqual([["papryka", "2"], ["cebula", null], ["szafran", "szczypta"]]);
    expect(r.ver).toBe(true);
    expect(s.pantry.find(p => p.name === "szafran")).toMatchObject({ dzial: "Inne", have: false });
  });

  it("keeps ingredient sections and notes", () => {
    const s = demoState();
    applyAction(s, { action: "editRecipe", recipeId: "r002", ing: "Papryka: 2; # Sos; cebula: 1 (lub szalotka: 2)" });
    expect(s.recipes.find(x => x.id === "r002")!.ing).toEqual([
      { name: "papryka", qty: "2" }, { name: "cebula", qty: "1", sec: "Sos", note: "lub szalotka: 2" },
    ]);
  });

  it("leaves ingredients unchecked when only steps are edited", () => {
    const s = demoState();
    applyAction(s, { action: "editRecipe", recipeId: "r002", steps: "Jedyny krok" });
    const r = s.recipes.find(x => x.id === "r002")!;
    expect(r.steps).toEqual([{ text: "Jedyny krok" }]);
    expect(r.ver).toBe(false);
  });

  it("toggles pantry items and adds unknown ones", () => {
    const s = demoState();
    applyAction(s, { action: "setPantry", name: "Boczek", have: true });
    applyAction(s, { action: "setPantry", name: "szafran", have: true });
    const m = buildModel(s);
    expect(ingState(m, "boczek")).toBe("have");
    expect(m.pantry.get("szafran")).toMatchObject({ dzial: "Inne", have: true });
  });

  it("adds a new product from a recipe as not had, leaving existing items alone", () => {
    const s = demoState();
    applyAction(s, { action: "addPantry", name: "pinsa", dzial: "Pieczywo", have: false });
    applyAction(s, { action: "addPantry", name: "Jajka", dzial: "Inne", have: false });
    applyAction(s, { action: "addPantry", name: "szafran", dzial: "Sosy i przyprawy" });
    const m = buildModel(s);
    expect(m.pantry.get("pinsa")).toMatchObject({ dzial: "Pieczywo", have: false });
    expect(m.pantry.get("jajka")).toMatchObject({ dzial: "Nabiał i jajka", have: true });
    expect(m.pantry.get("szafran")).toMatchObject({ have: true });
  });

  it("removes products", () => {
    const s = demoState();
    applyAction(s, { action: "removePantry", name: "Boczek" });
    expect(buildModel(s).pantry.has("boczek")).toBe(false);
  });

  it("removes open extra items but keeps bought ones", () => {
    const s = demoState();
    const [folia] = extraItems("folia");
    applyAction(s, { action: "addExtra", items: [folia] });
    applyAction(s, { action: "setExtra", uid: folia.uid, bought: true });
    applyAction(s, { action: "addExtra", items: extraItems("Folia") });
    applyAction(s, { action: "removeExtra", item: "folia" });
    expect(s.extra.filter(x => x.item.toLowerCase() === "folia")).toEqual([{ uid: folia.uid, item: "folia", bought: true }]);
  });

  it("adds, cooks and removes plan entries by their id, and ignores a repeated add", () => {
    const s = demoState();
    const n = s.plan.length;
    const a = { action: "addPlan", uid: uid(), date: "2030-01-01", meal: "", id: "r003", text: "" } as const;
    const b = { ...a, uid: uid() };
    applyAction(s, a);
    applyAction(s, a); // a retried request
    applyAction(s, b);
    expect(s.plan.length).toBe(n + 2);
    applyAction(s, { action: "setCooked", uid: a.uid, cooked: true });
    expect(s.plan.slice(-2).map(p => p.cooked)).toEqual([true, false]);
    applyAction(s, { action: "removePlan", uid: b.uid });
    expect(s.plan.length).toBe(n + 1);
  });

  it("does not duplicate open shopping items and clears bought ones", () => {
    const s = demoState();
    applyAction(s, { action: "addExtra", items: extraItems("Papier do pieczenia", "boczek", "boczek") });
    expect(s.extra.map(x => x.item)).toEqual(["papier do pieczenia", "boczek"]);
    applyAction(s, { action: "setExtra", uid: s.extra[1].uid, bought: true });
    applyAction(s, { action: "clearBoughtExtra" });
    expect(s.extra.map(x => x.item)).toEqual(["papier do pieczenia"]);
  });
});

describe("admin catalog actions", () => {
  const recipe = { name: "Kasza", type: "Danie główne", diff: "Łatwy" as const, time: 20, cats: ["Kasza", "Kasza", " "], links: [], desc: "", steps: "Ugotuj", ing: "Kasza bulgur: 200 g; cebula", arch: false };

  it("creates a recipe under the phone's id, once", () => {
    const s = demoState();
    const id = uid();
    applyAction(s, { action: "createRecipe", recipeId: id, ...recipe, serv: 2 });
    applyAction(s, { action: "createRecipe", recipeId: id, ...recipe, serv: 2, name: "Inna" });
    const r = buildModel(s).recipes.filter(x => x.id === id);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: "Kasza", cats: ["Kasza"], ver: true, steps: [{ text: "Ugotuj" }], serv: 2 });
    expect(r[0].ing.map(i => i.name)).toEqual(["Kasza bulgur", "cebula"]);
    expect(s.pantry.find(p => p.name === "Kasza bulgur")).toMatchObject({ dzial: "Inne", have: false });
  });

  it("edits any recipe field and leaves the rest", () => {
    const s = demoState();
    applyAction(s, { action: "editRecipe", recipeId: "r002", name: "Leczo z cukinią", arch: true, time: 0, diff: "", serv: 4 });
    expect(s.recipes.find(r => r.id === "r002")).toMatchObject({ name: "Leczo z cukinią", arch: true, time: 0, diff: "", type: "Danie główne", ver: false, serv: 4 });
  });

  it("portions: a create queued before they existed gets 0, an edit without them leaves them", () => {
    const create = ActionSchema.parse({ action: "createRecipe", recipeId: uid(), ...recipe, cats: ["Kasza"] });
    expect(create).toMatchObject({ serv: 0 });
    expect(ActionSchema.parse({ action: "editRecipe", recipeId: "r002", name: "Leczo" })).not.toHaveProperty("serv");
    expect(ActionSchema.safeParse({ action: "editRecipe", recipeId: "r002", serv: 101 }).success).toBe(false);
  });

  it("a state cached before portions existed reads as no portions", () => {
    const s = demoState();
    for (const r of s.recipes) delete r.serv;
    expect(buildModel(s).recipes.every(r => r.serv === 0)).toBe(true);
  });

  it("renames a product everywhere, but not onto another product's name", () => {
    const s = demoState();
    applyAction(s, { action: "editIngredient", name: "boczek", newName: "Boczek wędzony", dzial: "Inne" });
    expect(s.pantry.find(p => p.name === "Boczek wędzony")).toMatchObject({ dzial: "Inne" });
    expect(s.recipes.find(r => r.id === "r001")!.ing.map(i => i.name)).toContain("Boczek wędzony");
    applyAction(s, { action: "editIngredient", name: "cebula", newName: "Czosnek", dzial: "Inne" });
    expect(s.pantry.find(p => p.name === "cebula")).toMatchObject({ dzial: "Warzywa i owoce" });
  });

  it("merges a product into another, keeping what the household had", () => {
    const s = demoState();
    applyAction(s, { action: "mergeIngredients", from: "cebula", into: "papryka" }); // cebula: mam
    const m = buildModel(s);
    expect(m.pantry.has("cebula")).toBe(false);
    expect(m.pantry.get("papryka")).toMatchObject({ have: true });
    expect(m.recipes.find(r => r.id === "r002")!.ing.filter(i => i.name === "papryka")).toHaveLength(2);
  });
});

describe("ActionSchema", () => {
  it("accepts what the app sends and rejects malformed actions", () => {
    expect(ActionSchema.safeParse({ action: "setRecipeField", recipeId: "3", field: "rate", value: 5 }).success).toBe(true);
    expect(ActionSchema.safeParse({ action: "setRecipeField", recipeId: "3", field: "rate", value: 9 }).success).toBe(false);
    expect(ActionSchema.safeParse({ action: "setRecipeField", recipeId: "3", field: "done", value: "tak" }).success).toBe(false);
    expect(ActionSchema.safeParse({ action: "addPlan", uid: "not-a-uuid", date: "2030-01-01", meal: "", id: "", text: "x" }).success).toBe(false);
    expect(ActionSchema.safeParse({ action: "setPantry", name: "   ", have: true }).success).toBe(false);
    expect(ActionSchema.safeParse({ action: "dropTables" }).success).toBe(false);
  });
});
