import { describe, expect, it } from "vitest";
import { applyAction, cloneTables } from "./actions";
import { demoTables } from "./mock";
import { buildModel, ingState } from "./model";

describe("applyAction", () => {
  it("sets recipe fields by id or by name", () => {
    const t = cloneTables(demoTables());
    applyAction(t, { action: "setRecipeField", by: "id", key: "r005", field: "done", value: true });
    applyAction(t, { action: "setRecipeField", by: "name", key: "carbonara", field: "rate", value: 4 });
    applyAction(t, { action: "setRecipeField", by: "id", key: "r002", field: "notes", value: "mniej soli" });
    const m = buildModel(t);
    const get = (id: string) => m.recipes.find(r => r.id === id)!;
    expect(get("r005").done).toBe(true);
    expect(get("r001").rate).toBe(4);
    expect(get("r002").notes).toBe("mniej soli");
  });

  it("clears the rating with 0", () => {
    const t = cloneTables(demoTables());
    applyAction(t, { action: "setRecipeField", by: "id", key: "r001", field: "rate", value: "" });
    expect(buildModel(t).recipes[0].rate).toBe(0);
  });

  it("toggles pantry items and adds unknown ones", () => {
    const t = cloneTables(demoTables());
    applyAction(t, { action: "setPantry", name: "Boczek", have: true });
    applyAction(t, { action: "setPantry", name: "szafran", have: true });
    const m = buildModel(t);
    expect(ingState(m, "boczek")).toBe("have");
    expect(m.pantry.get("szafran")).toMatchObject({ dzial: "Inne", have: true });
  });

  it("adds and removes plan entries", () => {
    const t = cloneTables(demoTables());
    const n = t.plan.length;
    applyAction(t, { action: "addPlan", date: "2030-01-01", meal: "Obiad", id: "r003", text: "" });
    expect(t.plan.length).toBe(n + 1);
    applyAction(t, { action: "removePlan", date: "2030-01-01", meal: "Obiad", id: "r003", text: "" });
    expect(t.plan.length).toBe(n);
  });

  it("marks one matching queue entry as cooked and back", () => {
    const t = cloneTables(demoTables());
    const e = { date: "2030-01-01", meal: "", id: "r003", text: "" };
    applyAction(t, { action: "addPlan", ...e });
    applyAction(t, { action: "addPlan", ...e });
    applyAction(t, { action: "setCooked", ...e, cooked: true });
    expect(t.plan.slice(-2).map(r => r[4])).toEqual(["TRUE", "FALSE"]);
    applyAction(t, { action: "setCooked", ...e, cooked: false });
    expect(t.plan.slice(-2).map(r => r[4])).toEqual(["FALSE", "FALSE"]);
  });

  it("does not duplicate open shopping items and clears bought ones", () => {
    const t = cloneTables(demoTables());
    applyAction(t, { action: "addExtra", items: ["Papier do pieczenia", "boczek", "boczek"] });
    expect(buildModel(t).extra.map(x => x.item)).toEqual(["papier do pieczenia", "boczek"]);
    applyAction(t, { action: "setExtra", item: "boczek", bought: true });
    applyAction(t, { action: "clearBoughtExtra" });
    expect(buildModel(t).extra.map(x => x.item)).toEqual(["papier do pieczenia"]);
  });
});
