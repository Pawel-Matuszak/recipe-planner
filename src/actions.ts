// Write actions shared by the client (optimistic update + sync queue), the demo backend
// and the Apps Script API (apps-script/Code.gs implements the same contract server-side).
import { norm, type Row, type Tables } from "./model";

export type RecipeField = "done" | "rate" | "notes";
export type Action =
  | { action: "setRecipeField"; by: "id" | "name"; key: string; field: RecipeField; value: boolean | number | string }
  // omitted fields stay as they are; sending `ing` also marks the ingredients as checked
  | { action: "editRecipe"; by: "id" | "name"; key: string; desc?: string; steps?: string; ing?: string }
  | { action: "setPantry"; name: string; have: boolean }
  | { action: "addPantry"; name: string; dzial: string }
  | { action: "removePantry"; name: string }
  | { action: "addPlan"; date: string; meal: string; id: string; text: string }
  | { action: "removePlan"; date: string; meal: string; id: string; text: string }
  | { action: "setCooked"; date: string; meal: string; id: string; text: string; cooked: boolean }
  | { action: "addExtra"; items: string[] }
  | { action: "setExtra"; item: string; bought: boolean }
  | { action: "removeExtra"; item: string }
  | { action: "clearBoughtExtra" };

const FIELD: Record<RecipeField, RegExp> = { done: /^było robione/, rate: /^ocena$/, notes: /^notatki$/ };
const EDIT = { desc: /^opis$/, steps: /^przepis$/, ing: /^składniki$/, ver: /^składniki sprawdz/ };
const cell = (v: boolean | number | string) => (typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v));
const col = (header: Row, re: RegExp) => header.findIndex(h => re.test(norm(h)));
const findIn = (rows: Row[], c: number, key: string) => rows.findIndex((r, i) => i > 0 && norm(r[c]) === norm(key));
const samePlan = (r: Row, a: { date: string; meal: string; id: string; text: string }) =>
  String(r[0]) === a.date && norm(r[1]) === norm(a.meal) && norm(r[2]) === norm(a.id) && norm(r[3]) === norm(a.text);
const setCell = (row: Row, c: number, v: string) => { while (row.length <= c) row.push(""); row[c] = v; };

/** Applies an action to the tables in place, mirroring what the server does. */
export function applyAction(t: Tables, a: Action): void {
  switch (a.action) {
    case "setRecipeField": {
      const h = t.main[0] ?? [];
      const keyCol = col(h, a.by === "name" ? /^nazwa$/ : /^id$/), fieldCol = col(h, FIELD[a.field]);
      const i = keyCol < 0 ? -1 : findIn(t.main, keyCol, a.key);
      if (i > 0 && fieldCol >= 0) setCell(t.main[i], fieldCol, a.field === "rate" && !a.value ? "" : cell(a.value));
      return;
    }
    case "editRecipe": {
      const h = t.main[0] ?? [];
      const keyCol = col(h, a.by === "name" ? /^nazwa$/ : /^id$/);
      const i = keyCol < 0 ? -1 : findIn(t.main, keyCol, a.key);
      if (i <= 0) return;
      const put = (re: RegExp, v: string | undefined) => { const c = col(h, re); if (v !== undefined && c >= 0) setCell(t.main[i], c, v); };
      put(EDIT.desc, a.desc);
      put(EDIT.steps, a.steps);
      put(EDIT.ing, a.ing);
      if (a.ing !== undefined) put(EDIT.ver, "TRUE");
      return;
    }
    case "setPantry": {
      const i = findIn(t.pantry, 0, a.name);
      if (i > 0) setCell(t.pantry[i], 2, cell(a.have));
      else t.pantry.push([a.name.trim(), "Inne", cell(a.have), "FALSE"]);
      return;
    }
    case "addPantry": {
      const i = findIn(t.pantry, 0, a.name);
      if (i > 0) setCell(t.pantry[i], 2, "TRUE");
      else t.pantry.push([a.name.trim(), a.dzial || "Inne", "TRUE", "FALSE"]);
      return;
    }
    case "removePantry": {
      const i = findIn(t.pantry, 0, a.name);
      if (i > 0) t.pantry.splice(i, 1);
      return;
    }
    case "addPlan":
      t.plan.push([a.date, a.meal, a.id, a.text, "FALSE"]);
      return;
    case "removePlan": {
      for (let i = t.plan.length - 1; i > 0; i--) {
        if (samePlan(t.plan[i], a)) { t.plan.splice(i, 1); return; }
      }
      return;
    }
    case "setCooked": {
      const i = t.plan.findIndex((r, k) => k > 0 && samePlan(r, a) && (norm(r[4]) === "true") !== a.cooked);
      if (i > 0) setCell(t.plan[i], 4, cell(a.cooked));
      return;
    }
    case "addExtra": {
      const open = new Set(t.extra.slice(1).filter(r => norm(r[1]) !== "true").map(r => norm(r[0])));
      for (const item of a.items) {
        if (!item.trim() || open.has(norm(item))) continue;
        t.extra.push([item.trim(), "FALSE"]);
        open.add(norm(item));
      }
      return;
    }
    case "setExtra": {
      const i = findIn(t.extra, 0, a.item);
      if (i > 0) setCell(t.extra[i], 1, cell(a.bought));
      return;
    }
    case "removeExtra":
      t.extra = [t.extra[0] ?? ["Pozycja", "Kupione"], ...t.extra.slice(1).filter(r => norm(r[1]) === "true" || norm(r[0]) !== norm(a.item))];
      return;
    case "clearBoughtExtra":
      t.extra = [t.extra[0] ?? ["Pozycja", "Kupione"], ...t.extra.slice(1).filter(r => norm(r[1]) !== "true")];
      return;
  }
}

export const cloneTables = (t: Tables): Tables => ({
  main: t.main.map(r => [...r]), pantry: t.pantry.map(r => [...r]), plan: t.plan.map(r => [...r]), extra: t.extra.map(r => [...r]),
});
