// Pure data model: turns the app state (from the server, or a parsed spreadsheet) into recipes/pantry/plan
// and answers "what can I cook" and "what do I need to buy". No DOM, no network.

export type Row = string[];
/** Raw spreadsheet tabs: the demo data and the one-off import from Google Sheets. */
export interface Tables { main: Row[]; pantry: Row[]; plan: Row[]; extra: Row[] }

export interface Recipe {
  id: string;          // stable key used by the UI and the plan (database id; "r001" or "#Name" for sheet data)
  name: string; type: string; diff: string; done: boolean; arch: boolean;
  links: string[]; cats: string[]; time: number; ing: Ing[]; ver: boolean; rate: number; notes: string;
  desc: string; steps: string[];
}
/** One product of the shared catalog, with this household's "Mam" / "Zawsze mam". */
export interface PantryItem { name: string; dzial: string; have: boolean; always: boolean }
/** `uid` is created on the phone, so a queued write can point at an entry the server hasn't seen yet. */
export interface PlanEntry { uid: string; date: string; meal: string; id: string; text: string; cooked: boolean }
export interface ExtraItem { uid: string; item: string; bought: boolean }
export interface Me { name: string; role: string }
export interface Model { me: Me; recipes: Recipe[]; pantry: Map<string, PantryItem>; plan: PlanEntry[]; extra: ExtraItem[] }

/** What the server sends (GET /api/state) and what the phone caches: the model as plain JSON, amounts unparsed. */
export interface StateRecipe extends Omit<Recipe, "ing"> { ing: { name: string; qty: string | null }[] }
export interface State { me: Me; recipes: StateRecipe[]; pantry: PantryItem[]; plan: PlanEntry[]; extra: ExtraItem[] }

export const isAdmin = (m: { me: Me }) => m.me.role === "admin";

export const DZIALY = ["Warzywa i owoce", "Mięso i ryby", "Nabiał i jajka", "Pieczywo", "Makaron, ryż, kasze", "Puszki i słoiki", "Sosy i przyprawy", "Pieczenie", "Inne"];

export const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
export const bool = (v: unknown) => v === true || String(v).toUpperCase() === "TRUE";
export const splitIng = (s: string) => String(s || "").split(";").map(x => x.trim()).filter(Boolean);

/* ---------- ingredient amounts: "makaron: 200 g; jajka: 3; pieprz" ---------- */

/** `value` is in the canonical unit (g, ml, …); null when the amount is free text like "do smaku". */
export interface Qty { value: number | null; unit: string; raw: string }
export interface Ing { name: string; qty: Qty | null }

// canonical unit, factor to it, accepted spellings, display forms [1, 2-4, 5+]
const UNITS: [string, number, string[], [string, string, string]][] = [
  ["g", 1, ["g", "gr", "gram", "gramy", "gramów"], ["g", "g", "g"]],
  ["g", 10, ["dag", "dkg"], ["g", "g", "g"]],
  ["g", 1000, ["kg", "kilogram", "kilogramy", "kilogramów"], ["g", "g", "g"]],
  ["ml", 1, ["ml", "mililitr", "mililitry", "mililitrów"], ["ml", "ml", "ml"]],
  ["ml", 1000, ["l", "litr", "litry", "litrów"], ["ml", "ml", "ml"]],
  ["szt", 1, ["", "szt", "sztuka", "sztuki", "sztuk"], ["szt.", "szt.", "szt."]],
  ["łyżka", 1, ["łyżka", "łyżki", "łyżek", "łyżkę", "łyż"], ["łyżka", "łyżki", "łyżek"]],
  ["łyżeczka", 1, ["łyżeczka", "łyżeczki", "łyżeczek", "łyżeczkę", "łyżecz"], ["łyżeczka", "łyżeczki", "łyżeczek"]],
  ["szklanka", 1, ["szklanka", "szklanki", "szklanek", "szklankę"], ["szklanka", "szklanki", "szklanek"]],
  ["ząbek", 1, ["ząbek", "ząbki", "ząbków", "ząbka"], ["ząbek", "ząbki", "ząbków"]],
  ["puszka", 1, ["puszka", "puszki", "puszek", "puszkę"], ["puszka", "puszki", "puszek"]],
  ["opak", 1, ["opak", "opakowanie", "opakowania", "opakowań"], ["opak.", "opak.", "opak."]],
  ["pęczek", 1, ["pęczek", "pęczki", "pęczków", "pęczka"], ["pęczek", "pęczki", "pęczków"]],
  ["garść", 1, ["garść", "garście", "garści"], ["garść", "garście", "garści"]],
  ["szczypta", 1, ["szczypta", "szczypty", "szczypt", "szczyptę"], ["szczypta", "szczypty", "szczypt"]],
  ["plaster", 1, ["plaster", "plastry", "plastrów", "plasterek", "plasterki", "plasterków"], ["plaster", "plastry", "plastrów"]],
];
const UNIT_OF = new Map(UNITS.flatMap(([unit, factor, names]) => names.map(n => [n, { unit, factor }] as const)));
const FORMS = new Map(UNITS.map(([unit, , , forms]) => [unit, forms]));
const FRACTIONS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
const NUM = String.raw`\d*\s*[½¼¾⅓⅔]|\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?`;
const QTY_RE = new RegExp(String.raw`^(${NUM})(?:\s*[-–]\s*(${NUM}))?\s*(.*)$`);

function num(s: string): number {
  const t = s.replace(/\s+/g, "").replace(",", ".");
  const frac = t.match(/[½¼¾⅓⅔]$/);
  if (frac) return (parseFloat(t) || 0) + FRACTIONS[frac[0]];
  const [a, b] = t.split("/");
  return b ? parseFloat(a) / parseFloat(b) : parseFloat(a);
}

export function parseQty(s: string): Qty | null {
  const raw = s.trim();
  if (!raw) return null;
  const m = raw.match(QTY_RE);
  if (!m) return { value: null, unit: "", raw };
  const n = num(m[2] ?? m[1]); // range "2-3" → buy for the upper bound
  const word = norm(m[3]).replace(/\.$/, "");
  const u = UNIT_OF.get(word);
  return u ? { value: n * u.factor, unit: u.unit, raw } : { value: n, unit: word, raw };
}

/** "śmietanka 30%: 200 ml" → name + amount; text without a colon is just a name. */
export function parseIng(s: string): Ing {
  const i = s.lastIndexOf(":");
  if (i < 0) return { name: s.trim(), qty: null };
  return { name: s.slice(0, i).trim(), qty: parseQty(s.slice(i + 1)) };
}

const fmtNum = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
function fmtUnit(value: number, unit: string): string {
  if (unit === "g" && value >= 1000) return `${fmtNum(value / 1000)} kg`;
  if (unit === "ml" && value >= 1000) return `${fmtNum(value / 1000)} l`;
  const f = FORMS.get(unit);
  const word = !f ? unit : Number.isInteger(value) ? plural(value, ...f) : f[1];
  return word ? `${fmtNum(value)} ${word}` : fmtNum(value);
}

// "40 g + 2 łyżki" in one cell is two amounts, so each part can add up with other recipes
const parts = (q: Qty | null): Qty[] => (!q ? [] : q.raw.includes("+") ? q.raw.split("+").map(parseQty).filter(x => x !== null) : [q]);

/** Adds amounts of the same ingredient; units of different kinds are listed side by side ("200 ml + 2 łyżki"). */
export function sumQty(qs: (Qty | null)[]): string {
  const sums = new Map<string, number>(), texts = new Set<string>();
  for (const q of qs.flatMap(parts)) {
    if (q.value === null) texts.add(q.raw);
    else sums.set(q.unit, (sums.get(q.unit) ?? 0) + q.value);
  }
  return [...[...sums].map(([u, v]) => fmtUnit(v, u)), ...texts].join(" + ");
}

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

const findCol = (headers: Row, test: (h: string) => boolean) => headers.findIndex(h => test(norm(h)));

/** Reads the Google Sheets tabs (columns matched by header). */
export function parseSheet(t: Tables, me: Me = { name: "", role: "user" }): Model {
  const [mh = [], ...mrows] = t.main;
  const ix = {
    name: findCol(mh, h => h === "nazwa"), type: findCol(mh, h => h === "typ"), diff: findCol(mh, h => h.startsWith("trudno")),
    done: findCol(mh, h => h.startsWith("było robione")), link: findCol(mh, h => h === "link"),
    k1: findCol(mh, h => /^kat\w*\s*1$/.test(h)), k2: findCol(mh, h => /^kat\w*\s*2$/.test(h)), arch: findCol(mh, h => h === "archived"),
    id: findCol(mh, h => h === "id"), time: findCol(mh, h => h.startsWith("czas")), ing: findCol(mh, h => h === "składniki"),
    ver: findCol(mh, h => h.startsWith("składniki sprawdz")), rate: findCol(mh, h => h === "ocena"), notes: findCol(mh, h => h === "notatki"),
    desc: findCol(mh, h => h === "opis"), steps: findCol(mh, h => h === "przepis"),
  };
  const g = (r: Row, k: keyof typeof ix) => (ix[k] >= 0 ? String(r[ix[k]] ?? "") : "");

  const recipes: Recipe[] = [];
  for (const r of mrows) {
    const name = g(r, "name").trim();
    if (!name) continue;
    const sheetId = g(r, "id").trim();
    recipes.push({
      id: sheetId || "#" + name,
      name, type: g(r, "type").trim() || "Inne", diff: g(r, "diff").trim(), done: bool(g(r, "done")), arch: bool(g(r, "arch")),
      links: g(r, "link").split(/,(?=\s*(?:https?:|www\.))/).map(s => s.trim()).filter(s => /^(https?:\/\/|www\.)/i.test(s)),
      cats: [g(r, "k1"), g(r, "k2")].map(s => s.trim()).filter(Boolean),
      time: parseInt(g(r, "time"), 10) || 0, ing: splitIng(g(r, "ing")).map(parseIng), ver: bool(g(r, "ver")),
      rate: parseInt(g(r, "rate"), 10) || 0, notes: g(r, "notes"),
      desc: g(r, "desc").trim(),
      // one step per line; a leading "1." / "2)" is dropped since the UI numbers steps itself
      steps: g(r, "steps").split(/\r?\n/).map(s => s.trim().replace(/^\d+[.)]\s*/, "")).filter(Boolean),
    });
  }

  const pantry = new Map<string, PantryItem>();
  for (const r of t.pantry.slice(1)) {
    const name = String(r[0] ?? "").trim();
    if (name) pantry.set(norm(name), { name, dzial: String(r[1] ?? "").trim() || "Inne", have: bool(r[2]), always: bool(r[3]) });
  }

  const plan = t.plan.slice(1)
    .map(r => ({ uid: newId(), date: parseDate(r[0]), meal: String(r[1] ?? "").trim(), id: String(r[2] ?? "").trim(), text: String(r[3] ?? "").trim(), cooked: bool(r[4]) }))
    .filter(p => p.date && (p.id || p.text));

  const extra = t.extra.slice(1).map(r => ({ uid: newId(), item: String(r[0] ?? "").trim(), bought: bool(r[1]) })).filter(x => x.item);

  return { me, recipes, pantry, plan, extra };
}

export const newId = () => crypto.randomUUID();

export function buildModel(s: State): Model {
  return {
    me: s.me,
    recipes: s.recipes.map(r => ({ ...r, ing: r.ing.map(i => ({ name: i.name, qty: i.qty ? parseQty(i.qty) : null })) })),
    pantry: new Map(s.pantry.map(p => [norm(p.name), p])),
    plan: s.plan,
    extra: s.extra,
  };
}

export function toState(m: Model): State {
  return {
    me: m.me,
    recipes: m.recipes.map(r => ({ ...r, ing: r.ing.map(i => ({ name: i.name, qty: i.qty?.raw ?? null })) })),
    pantry: [...m.pantry.values()],
    plan: m.plan,
    extra: m.extra,
  };
}

export type IngState = "have" | "miss" | "always";
export function ingState(m: Model, name: string): IngState {
  const p = m.pantry.get(norm(name));
  if (!p) return "miss";
  if (p.always) return "always";
  return p.have ? "have" : "miss";
}
export const missingOf = (m: Model, r: Recipe) => r.ing.filter(i => ingState(m, i.name) === "miss");

/* ---------- matching names to the pantry: "maslo orzechowe" → "masło orzechowe" ---------- */

const PL: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
export const foldPl = (s: string) => norm(s).replace(/[ąćęłńóśźż]/g, c => PL[c]).replace(/\s+/g, " ");
const wordsOf = (s: string) => foldPl(s).split(" ").filter(Boolean).sort();

function lev(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Pantry name that is surely the same product as an ingredient that isn't in the pantry: the same words in any
 * order without Polish letters, or a typo. Null when it is in the pantry or nothing is that close; one name
 * containing the other ("jogurt" in "jogurt naturalny") is left to `similarIngredients`, as it may be another product.
 */
export function suggestIngredient(name: string, pantry: Map<string, PantryItem>): string | null {
  if (!norm(name) || pantry.has(norm(name))) return null;
  const key = wordsOf(name).join(" ");
  const items = [...pantry.values()].map(p => ({ name: p.name, w: wordsOf(p.name) }));
  const same = items.find(p => p.w.join(" ") === key);
  if (same) return same.name;

  const maxTypo = key.length <= 4 ? 0 : key.length <= 8 ? 1 : 2;
  let best: { name: string; d: number } | null = null;
  for (const p of items) {
    const d = lev(key, p.w.join(" "));
    if (d <= maxTypo && (!best || d < best.d)) best = { name: p.name, d };
  }
  return best?.name ?? null;
}

/**
 * Pantry names sharing a word with an unknown ingredient ("jogurt naturalny" → "jogurt grecki"). Weaker than
 * `suggestIngredient`: they may be different products, so the UI offers them next to adding a new one.
 * Names sharing the first word come first, then more shared words, then shorter names.
 */
export function similarIngredients(name: string, pantry: Map<string, PantryItem>, limit = 3): string[] {
  if (!norm(name) || pantry.has(norm(name))) return [];
  const w = wordsOf(name).filter(x => x.length >= 3), first = foldPl(name).split(" ")[0];
  return [...pantry.values()]
    .map(p => {
      const pw = wordsOf(p.name);
      return { name: p.name, head: foldPl(p.name).split(" ")[0] === first ? 1 : 0, shared: w.filter(x => pw.includes(x)).length };
    })
    .filter(p => p.shared > 0)
    .sort((a, b) => b.head - a.head || b.shared - a.shared || a.name.length - b.name.length || a.name.localeCompare(b.name, "pl"))
    .slice(0, limit)
    .map(p => p.name);
}

/** Ingredients of a recipe that aren't in the pantry at all (typos, new products). */
export const unknownOf = (m: Model, r: Recipe) => r.ing.filter(i => !m.pantry.has(norm(i.name)));

export interface Filters { q: string; type: string; cat: string; maxTime: number; can: boolean; todo: boolean; arch: boolean }

export function filterRecipes(m: Model, f: Filters): Recipe[] {
  const q = norm(f.q);
  const list = m.recipes.filter(r => {
    if (!f.arch && r.arch) return false;
    if (f.type !== "Wszystkie" && r.type !== f.type) return false;
    if (f.cat && !r.cats.includes(f.cat)) return false;
    if (f.maxTime && !(r.time && r.time <= f.maxTime)) return false;
    if (f.todo && r.done) return false;
    if (q && !(norm(r.name).includes(q) || r.ing.some(i => norm(i.name).includes(q)) || r.cats.some(c => norm(c).includes(q)))) return false;
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

export interface ShoppingNeed { name: string; dzial: string; total: string; for: { recipe: string; qty: string }[] }

/** Missing ingredients of recipes in the "do ugotowania" queue (not cooked yet), amounts summed across recipes. */
export function shoppingItems(m: Model): ShoppingNeed[] {
  const need = new Map<string, { name: string; dzial: string; by: Map<string, (Qty | null)[]> }>();
  for (const p of m.plan) {
    if (!p.id || p.cooked) continue;
    const r = m.recipes.find(x => x.id === p.id);
    if (!r) continue;
    for (const i of missingOf(m, r)) {
      const k = norm(i.name);
      const e = need.get(k) ?? { name: i.name, dzial: m.pantry.get(k)?.dzial ?? "Inne", by: new Map() };
      (e.by.get(r.name) ?? e.by.set(r.name, []).get(r.name)!).push(i.qty);
      need.set(k, e);
    }
  }
  return [...need.values()].map(({ name, dzial, by }) => ({
    name, dzial, total: sumQty([...by.values()].flat()),
    for: [...by].map(([recipe, qs]) => ({ recipe, qty: sumQty(qs) })),
  }));
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
