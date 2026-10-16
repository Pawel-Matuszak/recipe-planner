// Pure data model: turns raw sheet tables into recipes/pantry/plan and answers
// "what can I cook" and "what do I need to buy". No DOM, no network.

export type Row = string[];
export interface Tables { main: Row[]; pantry: Row[]; plan: Row[]; extra: Row[] }

export interface Recipe {
  id: string;          // stable key used by the UI and the plan ("r001", or "#Name" when the sheet row has no ID)
  key: string;         // value the API looks up
  by: "id" | "name";   // which column `key` lives in
  name: string; type: string; diff: string; done: boolean; arch: boolean;
  links: string[]; cats: string[]; time: number; ing: string[]; ver: boolean; rate: number; notes: string;
}
export interface PantryItem { name: string; dzial: string; have: boolean; always: boolean }
export interface PlanEntry { date: string; meal: string; id: string; text: string; cooked: boolean }
export interface ExtraItem { item: string; bought: boolean }
export interface Model { recipes: Recipe[]; pantry: Map<string, PantryItem>; plan: PlanEntry[]; extra: ExtraItem[] }

export const MEALS = ["Śniadanie", "Obiad", "Kolacja", "Przekąska"];
export const DAYS = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
export const DZIALY = ["Warzywa i owoce", "Mięso i ryby", "Nabiał i jajka", "Pieczywo", "Makaron, ryż, kasze", "Puszki i słoiki", "Sosy i przyprawy", "Pieczenie", "Inne"];

export const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
export const bool = (v: unknown) => v === true || String(v).toUpperCase() === "TRUE";
export const splitIng = (s: string) => String(s || "").split(";").map(x => x.trim()).filter(Boolean);

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseDate(v: unknown): string {
  const s = String(v ?? "").trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return "";
}

/** Monday-to-Sunday dates of the week `offset` weeks from the one containing `today`. */
export function weekDates(offset: number, today = new Date()): Date[] {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + i));
}

const findCol = (headers: Row, test: (h: string) => boolean) => headers.findIndex(h => test(norm(h)));

export function buildModel(t: Tables): Model {
  const [mh = [], ...mrows] = t.main;
  const ix = {
    name: findCol(mh, h => h === "nazwa"), type: findCol(mh, h => h === "typ"), diff: findCol(mh, h => h.startsWith("trudno")),
    done: findCol(mh, h => h.startsWith("było robione")), link: findCol(mh, h => h === "link"),
    k1: findCol(mh, h => /^kat\w*\s*1$/.test(h)), k2: findCol(mh, h => /^kat\w*\s*2$/.test(h)), arch: findCol(mh, h => h === "archived"),
    id: findCol(mh, h => h === "id"), time: findCol(mh, h => h.startsWith("czas")), ing: findCol(mh, h => h === "składniki"),
    ver: findCol(mh, h => h.startsWith("składniki sprawdz")), rate: findCol(mh, h => h === "ocena"), notes: findCol(mh, h => h === "notatki"),
  };
  const g = (r: Row, k: keyof typeof ix) => (ix[k] >= 0 ? String(r[ix[k]] ?? "") : "");

  const recipes: Recipe[] = [];
  for (const r of mrows) {
    const name = g(r, "name").trim();
    if (!name) continue;
    const sheetId = g(r, "id").trim();
    recipes.push({
      id: sheetId || "#" + name, key: sheetId || name, by: sheetId ? "id" : "name",
      name, type: g(r, "type").trim() || "Inne", diff: g(r, "diff").trim(), done: bool(g(r, "done")), arch: bool(g(r, "arch")),
      links: g(r, "link").split(/,(?=\s*(?:https?:|www\.))/).map(s => s.trim()).filter(s => /^(https?:\/\/|www\.)/i.test(s)),
      cats: [g(r, "k1"), g(r, "k2")].map(s => s.trim()).filter(Boolean),
      time: parseInt(g(r, "time"), 10) || 0, ing: splitIng(g(r, "ing")), ver: bool(g(r, "ver")),
      rate: parseInt(g(r, "rate"), 10) || 0, notes: g(r, "notes"),
    });
  }

  const pantry = new Map<string, PantryItem>();
  for (const r of t.pantry.slice(1)) {
    const name = String(r[0] ?? "").trim();
    if (name) pantry.set(norm(name), { name, dzial: String(r[1] ?? "").trim() || "Inne", have: bool(r[2]), always: bool(r[3]) });
  }

  const plan = t.plan.slice(1)
    .map(r => ({ date: parseDate(r[0]), meal: String(r[1] ?? "").trim(), id: String(r[2] ?? "").trim(), text: String(r[3] ?? "").trim(), cooked: bool(r[4]) }))
    .filter(p => p.date && (p.id || p.text));

  const extra = t.extra.slice(1).map(r => ({ item: String(r[0] ?? "").trim(), bought: bool(r[1]) })).filter(x => x.item);

  return { recipes, pantry, plan, extra };
}

export type IngState = "have" | "miss" | "always";
export function ingState(m: Model, name: string): IngState {
  const p = m.pantry.get(norm(name));
  if (!p) return "miss";
  if (p.always) return "always";
  return p.have ? "have" : "miss";
}
export const missingOf = (m: Model, r: Recipe) => r.ing.filter(i => ingState(m, i) === "miss");

export interface Filters { q: string; type: string; cat: string; maxTime: number; can: boolean; todo: boolean; arch: boolean }

export function filterRecipes(m: Model, f: Filters): Recipe[] {
  const q = norm(f.q);
  const list = m.recipes.filter(r => {
    if (!f.arch && r.arch) return false;
    if (f.type !== "Wszystkie" && r.type !== f.type) return false;
    if (f.cat && !r.cats.includes(f.cat)) return false;
    if (f.maxTime && !(r.time && r.time <= f.maxTime)) return false;
    if (f.todo && r.done) return false;
    if (q && !(norm(r.name).includes(q) || r.ing.some(i => norm(i).includes(q)) || r.cats.some(c => norm(c).includes(q)))) return false;
    return true;
  });
  if (!f.can) return list;
  return list
    .filter(r => r.ing.length)
    .map(r => ({ r, miss: missingOf(m, r).length }))
    .sort((a, b) => a.miss - b.miss || (a.r.time || 999) - (b.r.time || 999))
    .map(x => x.r);
}

/** Pool for "Losuj": prefer main dishes missing at most 2 ingredients. */
export function randomPool(m: Model, list: Recipe[], preferMain: boolean): Recipe[] {
  let pool = list.filter(r => r.ing.length);
  if (preferMain) pool = pool.filter(r => r.type === "Danie główne");
  const near = pool.filter(r => missingOf(m, r).length <= 2);
  return near.length ? near : pool;
}

export interface ShoppingNeed { name: string; dzial: string; for: string[] }

/** Missing ingredients of recipes planned (and not cooked) in the given dates. */
export function shoppingItems(m: Model, dates: string[]): ShoppingNeed[] {
  const days = new Set(dates);
  const need = new Map<string, ShoppingNeed>();
  for (const p of m.plan) {
    if (!days.has(p.date) || !p.id || p.cooked) continue;
    const r = m.recipes.find(x => x.id === p.id);
    if (!r) continue;
    for (const i of missingOf(m, r)) {
      const k = norm(i);
      const e = need.get(k) ?? { name: i, dzial: m.pantry.get(k)?.dzial ?? "Inne", for: [] };
      if (!e.for.includes(r.name)) e.for.push(r.name);
      need.set(k, e);
    }
  }
  return [...need.values()];
}

export function groupBy<T>(items: T[], key: (t: T) => string): [string, T[]][] {
  const g = new Map<string, T[]>();
  for (const it of items) { const k = key(it); (g.get(k) ?? g.set(k, []).get(k)!).push(it); }
  const order = (k: string) => { const i = DZIALY.indexOf(k); return i < 0 ? 99 : i; };
  return [...g.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0], "pl"));
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (n === 1) return one;
  return m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
}
