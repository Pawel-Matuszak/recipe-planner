import { describe, expect, it } from "vitest";
import { buildModel, filterRecipes, iso, missingOf, parseDate, plural, randomPool, shoppingItems, weekDates, type Filters, type Tables } from "./model";

const MAIN_HEADER = ["Obrazek", "Nazwa", "Typ", "Trudność", "Było robione?", "Link", "Kategoria 1", "Kateogria 2", "Archived", "ID", "Czas (min)", "Składniki", "Składniki sprawdzone", "Ocena", "Notatki"];
const recipe = (id: string, name: string, ing: string, extra: Partial<Record<string, string>> = {}) => {
  const row = MAIN_HEADER.map(() => "");
  const set = (h: string, v: string) => { row[MAIN_HEADER.indexOf(h)] = v; };
  set("Nazwa", name); set("ID", id); set("Typ", extra.typ ?? "Danie główne"); set("Składniki", ing);
  set("Czas (min)", extra.czas ?? "30"); set("Archived", extra.arch ?? "FALSE"); set("Było robione?", extra.done ?? "FALSE");
  set("Link", extra.link ?? ""); set("Kategoria 1", extra.k1 ?? "");
  return row;
};

const tables = (): Tables => ({
  main: [
    MAIN_HEADER,
    recipe("r001", "Carbonara", "makaron; boczek; jajka; parmezan; pieprz", { czas: "20", k1: "Makaron", done: "TRUE" }),
    recipe("r002", "Leczo", "kiełbasa; cukinia; papryka; cebula; olej", { czas: "60" }),
    recipe("r003", "Omlet", "jajka; masło; sól", { czas: "10", typ: "Śniadanie" }),
    recipe("", "Nowe danie bez ID", "jajka; tortilla"),
    recipe("r004", "Stare", "jajka", { arch: "TRUE" }),
    recipe("r005", "Pizza", "mąka; drożdże", { link: "https://youtu.be/a,https://example.com/b" }),
  ],
  pantry: [
    ["Składnik", "Dział", "Mam", "Zawsze mam"],
    ["makaron", "Makaron, ryż, kasze", "TRUE", "FALSE"],
    ["jajka", "Nabiał i jajka", "TRUE", "FALSE"],
    ["boczek", "Mięso i ryby", "FALSE", "FALSE"],
    ["parmezan", "Nabiał i jajka", "FALSE", "FALSE"],
    ["pieprz", "Sosy i przyprawy", "FALSE", "TRUE"],
    ["sól", "Sosy i przyprawy", "FALSE", "TRUE"],
    ["olej", "Inne", "FALSE", "TRUE"],
    ["masło", "Nabiał i jajka", "TRUE", "FALSE"],
    ["cebula", "Warzywa i owoce", "FALSE", "FALSE"],
  ],
  plan: [
    ["Data", "Posiłek", "ID przepisu", "Tekst", "Ugotowane"],
    ["2026-10-12", "Obiad", "r001", "", "FALSE"],
    ["14.10.2026", "Obiad", "r002", "", "FALSE"],
    ["2026-10-15", "Kolacja", "", "kanapki", "FALSE"],
    ["2026-10-16", "Obiad", "r002", "", "TRUE"],
    ["2026-10-20", "Obiad", "r001", "", "FALSE"],
  ],
  extra: [["Pozycja", "Kupione"], ["papier do pieczenia", "FALSE"], ["", ""]],
});

const F: Filters = { q: "", type: "Wszystkie", cat: "", maxTime: 0, can: false, todo: false, arch: false };

describe("buildModel", () => {
  it("reads recipes by header, keeps rows without ID under their name", () => {
    const m = buildModel(tables());
    expect(m.recipes.map(r => r.id)).toEqual(["r001", "r002", "r003", "#Nowe danie bez ID", "r004", "r005"]);
    const noId = m.recipes.find(r => r.name === "Nowe danie bez ID")!;
    expect(noId).toMatchObject({ by: "name", key: "Nowe danie bez ID" });
    expect(m.recipes[0]).toMatchObject({ time: 20, done: true, cats: ["Makaron"] });
  });

  it("finds columns even when they are reordered", () => {
    const t = tables();
    t.main = t.main.map(r => [...r].reverse());
    const m = buildModel(t);
    expect(m.recipes[0]).toMatchObject({ id: "r001", name: "Carbonara", time: 20 });
  });

  it("splits several links in one cell", () => {
    expect(buildModel(tables()).recipes.find(r => r.id === "r005")!.links).toEqual(["https://youtu.be/a", "https://example.com/b"]);
  });

  it("parses plan dates in several formats and skips empty rows", () => {
    const m = buildModel(tables());
    expect(m.plan.map(p => p.date)).toEqual(["2026-10-12", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-20"]);
    expect(m.extra).toEqual([{ item: "papier do pieczenia", bought: false }]);
  });
});

describe("missing ingredients", () => {
  it("counts pantry 'have' and 'always' as available, unknown as missing", () => {
    const m = buildModel(tables());
    const byName = (n: string) => m.recipes.find(r => r.name === n)!;
    expect(missingOf(m, byName("Carbonara"))).toEqual(["boczek", "parmezan"]);
    expect(missingOf(m, byName("Omlet"))).toEqual([]);
    expect(missingOf(m, byName("Leczo"))).toEqual(["kiełbasa", "cukinia", "papryka", "cebula"]);
  });

  it("'Mogę zrobić teraz' sorts by fewest missing and hides archived", () => {
    const m = buildModel(tables());
    const list = filterRecipes(m, { ...F, can: true });
    expect(list[0].name).toBe("Omlet");
    expect(list.some(r => r.arch)).toBe(false);
  });

  it("filters by time, type, todo and search over ingredients", () => {
    const m = buildModel(tables());
    expect(filterRecipes(m, { ...F, maxTime: 15 }).map(r => r.name)).toEqual(["Omlet"]);
    expect(filterRecipes(m, { ...F, type: "Śniadanie" }).map(r => r.name)).toEqual(["Omlet"]);
    expect(filterRecipes(m, { ...F, todo: true }).some(r => r.name === "Carbonara")).toBe(false);
    expect(filterRecipes(m, { ...F, q: "boczek" }).map(r => r.name)).toEqual(["Carbonara"]);
    expect(filterRecipes(m, { ...F, arch: true }).some(r => r.name === "Stare")).toBe(true);
  });

  it("random pool prefers main dishes missing at most 2", () => {
    const m = buildModel(tables());
    const pool = randomPool(m, filterRecipes(m, F), true);
    expect(pool.map(r => r.name).sort()).toEqual(["Carbonara", "Nowe danie bez ID", "Pizza"]);
  });
});

describe("shopping list", () => {
  it("collects missing ingredients for planned, not-cooked recipes in the week", () => {
    const m = buildModel(tables());
    const week = weekDates(0, new Date(2026, 9, 14)).map(iso);
    const items = shoppingItems(m, week);
    expect(items.map(i => i.name)).toEqual(["boczek", "parmezan", "kiełbasa", "cukinia", "papryka", "cebula"]);
    expect(items.find(i => i.name === "cebula")).toMatchObject({ dzial: "Warzywa i owoce", for: ["Leczo"] });
    expect(items.find(i => i.name === "kiełbasa")!.dzial).toBe("Inne");
  });
});

describe("dates and words", () => {
  it("weekDates starts on Monday", () => {
    const w = weekDates(0, new Date(2026, 9, 18)); // Sunday
    expect(w[0].getDay()).toBe(1);
    expect(w[0].getDate()).toBe(12);
    expect(weekDates(1, new Date(2026, 9, 18))[0].getDate()).toBe(19);
  });
  it("parseDate rejects junk", () => expect(parseDate("jutro")).toBe(""));
  it("polish plurals", () => {
    expect([1, 2, 5, 12, 22, 25].map(n => plural(n, "przepis", "przepisy", "przepisów")))
      .toEqual(["przepis", "przepisy", "przepisów", "przepisów", "przepisy", "przepisów"]);
  });
});
