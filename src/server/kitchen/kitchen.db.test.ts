// /api/state and /api/actions end to end: real sessions, the demo data imported into a household.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { applyAction, cloneState, extraItems, type Action } from "../../actions";
import * as actionsRoute from "../../app/api/actions/route";
import * as stateRoute from "../../app/api/state/route";
import { demoTables } from "../../mock";
import { DZIALY, parseSheet, type State } from "../../model";
import { createDb, truncateAll } from "../db";
import { importModel } from "../import/fromModel";
import { call, signUp } from "../test/http";

const db = createDb();
const uid = () => crypto.randomUUID();

let ania: string; // cookie of a member of the demo household
let householdId: string;

beforeEach(async () => {
  await truncateAll(db);
  const u = await signUp("ania@example.com");
  ania = u.cookie;
  householdId = (await db.household.create({ data: { name: "Dom", members: { create: { userId: u.id, role: "owner" } } } })).id;
  await db.$transaction(tx => importModel(tx, parseSheet(demoTables()), { householdId, createdById: null }), { timeout: 30_000 });
});
afterAll(() => db.$disconnect());

const getState = async (cookie = ania): Promise<State> => {
  const r = await call(stateRoute.GET, cookie);
  expect(r.status).toBe(200);
  return r.json.result;
};
const send = (a: unknown, cookie = ania) => call(actionsRoute.POST, cookie, a);
const recipeId = (s: State, name: string) => s.recipes.find(r => r.name === name)!.id;

/** Order-independent form of a state, for comparing the server's answer with the phone's optimistic copy. */
const canonical = (s: State) => ({
  ...s,
  recipes: [...s.recipes].sort((a, b) => a.id.localeCompare(b.id)),
  pantry: [...s.pantry].sort((a, b) => a.name.localeCompare(b.name)),
});

describe("GET /api/state", () => {
  it("returns the shared catalog with this household's own state", async () => {
    const s = await getState();
    expect(s.me).toEqual({ name: "ania", role: "user" });
    expect(s.recipes).toHaveLength(10);
    expect(s.recipes.find(r => r.name === "Carbonara")).toMatchObject({
      done: true, rate: 5, diff: "Średni", time: 20, cats: ["Makaron"], type: "Danie główne",
      ing: expect.arrayContaining([{ name: "makaron", qty: "200 g" }, { name: "pieprz", qty: null }]),
    });
    expect(s.pantry.find(p => p.name === "pieprz")).toMatchObject({ dzial: "Sosy i przyprawy", always: true });
    expect(s.dzialy).toEqual(DZIALY);
    expect(s.plan.map(p => p.text || s.recipes.find(r => r.id === p.id)!.name).sort())
      .toEqual(["Carbonara", "Chili con carne", "Leczo", "Overnight oats", "kanapki z szynką"]);
  });

  it("is refused without a household, and without a session", async () => {
    const lone = await signUp("bez-domu@example.com");
    expect((await call(stateRoute.GET, lone.cookie)).json).toMatchObject({ error: "no_household" });
    expect((await call(stateRoute.GET, "")).status).toBe(401);
  });
});

describe("POST /api/actions", () => {
  it("ends in the same state as the phone's optimistic update", async () => {
    const before = await getState();
    const leczo = recipeId(before, "Leczo"), pesto = recipeId(before, "Pesto");
    const planned = uid();
    const [chleb] = extraItems("chleb");
    const actions: Action[] = [
      { action: "setRecipeField", recipeId: leczo, field: "done", value: true },
      { action: "setRecipeField", recipeId: leczo, field: "rate", value: 4 },
      { action: "setRecipeField", recipeId: leczo, field: "notes", value: "więcej papryki" },
      { action: "setRecipeField", recipeId: recipeId(before, "Carbonara"), field: "rate", value: "" },
      { action: "setPantry", name: "Boczek", have: true },
      { action: "setPantry", name: "szafran", have: true },
      { action: "addPantry", name: "pinsa", dzial: "Pieczywo", have: false },
      { action: "addPantry", name: "jajka", dzial: "Inne", have: false },
      { action: "addPlan", uid: planned, date: "2030-01-01", meal: "", id: pesto, text: "" },
      { action: "addPlan", uid: planned, date: "2030-01-01", meal: "", id: pesto, text: "" }, // retried
      { action: "addPlan", uid: uid(), date: "2030-01-02", meal: "", id: "", text: "pizza na mieście" },
      { action: "setCooked", uid: planned, cooked: true },
      { action: "removePlan", uid: before.plan[0].uid },
      { action: "addExtra", items: [chleb, ...extraItems("Chleb", "masło")] },
      { action: "setExtra", uid: chleb.uid, bought: true },
      { action: "removeExtra", item: "MASŁO" },
      { action: "clearBoughtExtra" },
    ];
    const expected = cloneState(before);
    for (const a of actions) {
      applyAction(expected, a);
      expect((await send(a)).status, a.action).toBe(200);
    }
    expect(canonical(await getState())).toEqual(canonical(expected));
  });

  it("admin catalog changes end in the same state as the phone's optimistic update", async () => {
    await db.user.update({ where: { email: "ania@example.com" }, data: { role: "admin" } });
    const before = await getState();
    const leczo = recipeId(before, "Leczo");
    const fresh = uid();
    const actions: Action[] = [
      {
        action: "createRecipe", recipeId: fresh, name: "Kasza z warzywami", type: "Obiad jednogarnkowy", diff: "Łatwy", time: 25,
        cats: ["Warzywa", "Nowe"], links: ["https://example.com/kasza"], desc: "Szybki obiad.", steps: "Ugotuj kaszę\nDodaj warzywa",
        ing: "kasza bulgur: 200 g; Cukinia: 1; papryka", arch: false, serv: 3,
      },
      { action: "createRecipe", recipeId: fresh, name: "Powtórka", type: "Deser", diff: "", time: 0, cats: [], links: [], desc: "", steps: "", ing: "", arch: false, serv: 0 }, // retried: ignored
      { action: "addPlan", uid: uid(), date: "2030-01-01", meal: "", id: fresh, text: "" },
      { action: "setRecipeField", recipeId: fresh, field: "rate", value: 5 },
      { action: "editRecipe", recipeId: leczo, name: "Leczo z cukinią", diff: "Średni", time: 45, cats: ["Mięso"], links: [], arch: true, serv: 4 },
      { action: "editRecipe", recipeId: fresh, steps: "Jeden krok" },
      { action: "editIngredient", name: "kasza bulgur", newName: "Kasza bulgur", dzial: "Makaron, ryż, kasze" },
      { action: "editIngredient", name: "pomidory", dzial: "Puszki i słoiki" },
      { action: "setPantry", name: "papryka", have: true },
      { action: "mergeIngredients", from: "papryka", into: "cukinia" },
      { action: "mergeIngredients", from: "papryka", into: "cukinia" }, // retried: nothing left to merge
    ];
    const expected = cloneState(before);
    for (const a of actions) {
      applyAction(expected, a);
      const r = await send(a);
      expect(r.status, `${a.action}: ${JSON.stringify(r.json)}`).toBe(200);
    }
    const after = await getState();
    expect(canonical(after)).toEqual(canonical(expected));
    expect(after.recipes.find(r => r.id === fresh)).toMatchObject({ name: "Kasza z warzywami", rate: 5, ver: true, steps: [{ text: "Jeden krok" }], serv: 3 });
    expect(after.recipes.find(r => r.id === leczo)).toMatchObject({ serv: 4 });
    expect(after.plan.some(p => p.id === fresh)).toBe(true);
  });

  it("refuses renaming a product to a name another product has", async () => {
    await db.user.update({ where: { email: "ania@example.com" }, data: { role: "admin" } });
    const r = await send({ action: "editIngredient", name: "cebula", newName: "Czosnek" });
    expect(r.status).toBe(409);
    expect(r.json.message).toContain("Połącz");
  });

  it("files a new product in the chosen section, and refuses a section that isn't in the database", async () => {
    await db.user.update({ where: { email: "ania@example.com" }, data: { role: "admin" } });
    expect((await send({ action: "addPantry", name: "kajzerka", dzial: "Pieczywo", have: false })).status).toBe(200);
    expect((await send({ action: "addPantry", name: "kmin", dzial: "Przyprawy", have: false })).status).toBe(400);
    expect((await send({ action: "editIngredient", name: "kajzerka", dzial: "Przyprawy" })).status).toBe(400);
    const s = await getState();
    expect(s.pantry.find(p => p.name === "kajzerka")).toMatchObject({ dzial: "Pieczywo" });
    expect(s.pantry.some(p => p.name === "kmin")).toBe(false);
  });

  it("lets only admins edit recipes and delete products", async () => {
    const s = await getState();
    const edit = { action: "editRecipe", recipeId: recipeId(s, "Leczo"), steps: "Jeden krok\n# Na koniec\n1. Posyp", ing: "Cukinia: 2; # Na wierzch; kiełbasa: 300 g (lub boczek); nowość" };
    expect((await send(edit)).json).toMatchObject({ error: "forbidden" });
    expect((await send({ action: "removePantry", name: "sól" })).status).toBe(403);

    await db.user.update({ where: { email: "ania@example.com" }, data: { role: "admin" } });
    const expected = cloneState(await getState());
    applyAction(expected, edit as Action);
    expect((await send(edit)).status).toBe(200);
    expect((await send({ action: "removePantry", name: "sól" })).status).toBe(200);
    applyAction(expected, { action: "removePantry", name: "sól" });
    expect(canonical(await getState())).toEqual(canonical(expected));

    const inUse = await send({ action: "removePantry", name: "cukinia" });
    expect(inUse.status).toBe(409);
    expect(inUse.json.message).toContain("Leczo");
  });

  it("keeps households apart: another household can't see or change this one's rows", async () => {
    const s = await getState();
    const bartek = await signUp("bartek@example.com");
    await db.household.create({ data: { name: "Mieszkanie", members: { create: { userId: bartek.id, role: "owner" } } } });

    const theirs = await getState(bartek.cookie);
    expect(theirs.plan).toEqual([]);
    expect(theirs.extra).toEqual([]);
    expect(theirs.recipes.find(r => r.name === "Carbonara")).toMatchObject({ done: false, rate: 0 }); // catalog shared, state not
    expect(theirs.pantry.every(p => !p.have && !p.always)).toBe(true);

    await send({ action: "setCooked", uid: s.plan[1].uid, cooked: true }, bartek.cookie);
    await send({ action: "removePlan", uid: s.plan[2].uid }, bartek.cookie);
    await send({ action: "setExtra", uid: s.extra[0].uid, bought: true }, bartek.cookie);
    const after = await getState();
    expect(after.plan).toEqual(s.plan);
    expect(after.extra).toEqual(s.extra);
  });

  it("keeps shopping items in the order they were added, also when added together", async () => {
    const items = ["chleb", "masło", "ser", "jabłka", "kawa"];
    await send({ action: "addExtra", items: extraItems(...items) });
    expect((await getState()).extra.map(x => x.item)).toEqual(["papier do pieczenia", ...items]);
  });

  it("rejects malformed actions and unknown recipes", async () => {
    expect((await send({ action: "setPantry", name: "" })).status).toBe(400);
    expect((await send({ action: "setRecipeField", recipeId: "99999", field: "done", value: true })).json).toMatchObject({ error: "not_found" });
    expect((await send({ action: "addPlan", uid: uid(), date: "2030-01-01", meal: "", id: "", text: "  " })).status).toBe(400);
  });
});
