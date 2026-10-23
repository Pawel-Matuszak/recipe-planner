import { describe, expect, it } from "vitest";
import { parseSheet, filterRecipes, missingOf, parseDate, parseIng, plural, randomPool, shoppingItems, similarIngredients, suggestIngredient, sumQty, unknownOf, type Filters, type Tables } from "./model";

const MAIN_HEADER = ["Obrazek", "Nazwa", "Typ", "Trudność", "Było robione?", "Link", "Kategoria 1", "Kateogria 2", "Archived", "ID", "Czas (min)", "Składniki", "Składniki sprawdzone", "Ocena", "Notatki", "Opis", "Przepis"];
const recipe = (id: string, name: string, ing: string, extra: Partial<Record<string, string>> = {}) => {
  const row = MAIN_HEADER.map(() => "");
  const set = (h: string, v: string) => { row[MAIN_HEADER.indexOf(h)] = v; };
  set("Nazwa", name); set("ID", id); set("Typ", extra.typ ?? "Danie główne"); set("Składniki", ing);
  set("Czas (min)", extra.czas ?? "30"); set("Archived", extra.arch ?? "FALSE"); set("Było robione?", extra.done ?? "FALSE");
  set("Link", extra.link ?? ""); set("Kategoria 1", extra.k1 ?? ""); set("Opis", extra.opis ?? ""); set("Przepis", extra.przepis ?? "");
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

describe("parseSheet", () => {
  it("reads recipes by header, keeps rows without ID under their name", () => {
    const m = parseSheet(tables());
    expect(m.recipes.map(r => r.id)).toEqual(["r001", "r002", "r003", "#Nowe danie bez ID", "r004", "r005"]);
    expect(m.recipes[0]).toMatchObject({ time: 20, done: true, cats: ["Makaron"] });
  });

  it("finds columns even when they are reordered", () => {
    const t = tables();
    t.main = t.main.map(r => [...r].reverse());
    const m = parseSheet(t);
    expect(m.recipes[0]).toMatchObject({ id: "r001", name: "Carbonara", time: 20 });
  });

  it("splits several links in one cell", () => {
    expect(parseSheet(tables()).recipes.find(r => r.id === "r005")!.links).toEqual(["https://youtu.be/a", "https://example.com/b"]);
  });

  it("reads description and splits steps into lines, dropping blanks and existing numbering", () => {
    const t = tables();
    t.main[1] = recipe("r001", "Carbonara", "makaron", { opis: " Klasyk z Rzymu ", przepis: "1. Ugotuj makaron\r\n\n2) Podsmaż boczek\nWymieszaj z jajkami" });
    expect(parseSheet(t).recipes[0]).toMatchObject({ desc: "Klasyk z Rzymu", steps: ["Ugotuj makaron", "Podsmaż boczek", "Wymieszaj z jajkami"] });
  });

  it("gives empty description and steps when the sheet has no such columns", () => {
    const t = tables();
    t.main = t.main.map(r => r.slice(0, -2));
    expect(parseSheet(t).recipes[0]).toMatchObject({ desc: "", steps: [] });
  });

  it("parses plan dates in several formats and skips empty rows", () => {
    const m = parseSheet(tables());
    expect(m.plan.map(p => p.date)).toEqual(["2026-10-12", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-20"]);
    expect(m.extra).toEqual([{ uid: expect.any(String), item: "papier do pieczenia", bought: false }]);
  });
});

describe("missing ingredients", () => {
  it("counts pantry 'have' and 'always' as available, unknown as missing", () => {
    const m = parseSheet(tables());
    const byName = (n: string) => m.recipes.find(r => r.name === n)!;
    const miss = (n: string) => missingOf(m, byName(n)).map(i => i.name);
    expect(miss("Carbonara")).toEqual(["boczek", "parmezan"]);
    expect(miss("Omlet")).toEqual([]);
    expect(miss("Leczo")).toEqual(["kiełbasa", "cukinia", "papryka", "cebula"]);
  });

  it("'Mogę zrobić teraz' sorts by fewest missing and hides archived", () => {
    const m = parseSheet(tables());
    const list = filterRecipes(m, { ...F, can: true });
    expect(list[0].name).toBe("Omlet");
    expect(list.some(r => r.arch)).toBe(false);
  });

  it("filters by time, type, todo and search over ingredients", () => {
    const m = parseSheet(tables());
    expect(filterRecipes(m, { ...F, maxTime: 15 }).map(r => r.name)).toEqual(["Omlet"]);
    expect(filterRecipes(m, { ...F, type: "Śniadanie" }).map(r => r.name)).toEqual(["Omlet"]);
    expect(filterRecipes(m, { ...F, todo: true }).some(r => r.name === "Carbonara")).toBe(false);
    expect(filterRecipes(m, { ...F, q: "boczek" }).map(r => r.name)).toEqual(["Carbonara"]);
    expect(filterRecipes(m, { ...F, arch: true }).some(r => r.name === "Stare")).toBe(true);
  });

  it("random pool prefers main dishes missing at most 2", () => {
    const m = parseSheet(tables());
    const pool = randomPool(m, filterRecipes(m, F), true);
    expect(pool.map(r => r.name).sort()).toEqual(["Carbonara", "Nowe danie bez ID", "Pizza"]);
  });
});

describe("shopping list", () => {
  it("collects missing ingredients for queued, not-cooked recipes", () => {
    const m = parseSheet(tables());
    const items = shoppingItems(m);
    expect(items.map(i => i.name)).toEqual(["boczek", "parmezan", "kiełbasa", "cukinia", "papryka", "cebula"]);
    expect(items.find(i => i.name === "cebula")).toMatchObject({ dzial: "Warzywa i owoce", total: "", for: [{ recipe: "Leczo", qty: "" }] });
    expect(items.find(i => i.name === "kiełbasa")!.dzial).toBe("Inne");
  });

  it("sums amounts of the same ingredient across queued recipes", () => {
    const t = tables();
    t.main.push(recipe("r010", "Pasta rosa", "makaron: 250 g; śmietanka 30%: 200 ml; cebula: 1"));
    t.main[1] = recipe("r001", "Carbonara", "makaron: 0,5 kg; boczek: 150 g; cebula", { czas: "20" });
    t.pantry = t.pantry.filter(r => r[0] !== "makaron");
    t.plan.push(["2026-10-21", "", "r010", "", "FALSE"]);
    const makaron = shoppingItems(parseSheet(t)).find(i => i.name === "makaron")!;
    expect(makaron.total).toBe("1,25 kg"); // Carbonara is queued twice
    expect(makaron.for).toEqual([{ recipe: "Carbonara", qty: "1 kg" }, { recipe: "Pasta rosa", qty: "250 g" }]);
  });

  it("counts a recipe queued twice twice", () => {
    const t = tables();
    t.main[1] = recipe("r001", "Carbonara", "boczek: 150 g");
    expect(shoppingItems(parseSheet(t)).find(i => i.name === "boczek")!.total).toBe("300 g");
  });
});

describe("ingredient amounts", () => {
  const q = (s: string) => parseIng(s).qty;
  it("reads name and optional amount after the last colon", () => {
    expect(parseIng("pieprz")).toEqual({ name: "pieprz", qty: null });
    expect(parseIng("makaron: 200 g")).toEqual({ name: "makaron", qty: { value: 200, unit: "g", raw: "200 g" } });
    expect(parseIng("śmietanka 30%: 200 ml")).toMatchObject({ name: "śmietanka 30%", qty: { value: 200, unit: "ml" } });
    expect(parseIng("sos: sojowy: 2 łyżki").name).toBe("sos: sojowy");
    expect(parseIng("bazylia:")).toEqual({ name: "bazylia", qty: null });
  });

  it("normalizes units and numbers", () => {
    expect(q("mąka: 0,5 kg")).toMatchObject({ value: 500, unit: "g" });
    expect(q("mleko: 1.5 l")).toMatchObject({ value: 1500, unit: "ml" });
    expect(q("jajka: 3")).toMatchObject({ value: 3, unit: "szt" });
    expect(q("jajka: 3 szt.")).toMatchObject({ value: 3, unit: "szt" });
    expect(q("czosnek: 2 ząbki")).toMatchObject({ value: 2, unit: "ząbek" });
    expect(q("mleko: 1/2 szklanki")).toMatchObject({ value: 0.5, unit: "szklanka" });
    expect(q("mleko: 1½ szklanki")).toMatchObject({ value: 1.5, unit: "szklanka" });
    expect(q("pomidory: 2-3")).toMatchObject({ value: 3, unit: "szt" });
    expect(q("sól: do smaku")).toEqual({ value: null, unit: "", raw: "do smaku" });
    expect(q("ser: 2 kostki")).toMatchObject({ value: 2, unit: "kostki" });
  });

  it("sums and formats amounts", () => {
    const sum = (...s: string[]) => sumQty(s.map(x => parseIng("x: " + x).qty));
    expect(sum("200 g", "300 g")).toBe("500 g");
    expect(sum("700 g", "0,5 kg")).toBe("1,2 kg");
    expect(sum("200 ml", "2 łyżki")).toBe("200 ml + 2 łyżki");
    expect(sum("2 ząbki", "3 ząbki")).toBe("5 ząbków");
    expect(sum("1 łyżka")).toBe("1 łyżka");
    expect(sum("1/2 szklanki")).toBe("0,5 szklanki");
    expect(sum("3", "2 szt")).toBe("5 szt.");
    expect(sum("do smaku", "do smaku")).toBe("do smaku");
    expect(sum("30 g", "40 g + 2 łyżki")).toBe("70 g + 2 łyżki");
    expect(sumQty([null, parseIng("x: 100 g").qty])).toBe("100 g");
    expect(sumQty([null])).toBe("");
  });
});

describe("dates and words", () => {
  it("parseDate rejects junk", () => expect(parseDate("jutro")).toBe(""));
  it("polish plurals", () => {
    expect([1, 2, 5, 12, 22, 25].map(n => plural(n, "przepis", "przepisy", "przepisów")))
      .toEqual(["przepis", "przepisy", "przepisów", "przepisów", "przepisy", "przepisów"]);
  });
});

describe("matching ingredients to the pantry", () => {
  const pantry = parseSheet({ main: [MAIN_HEADER], plan: [], extra: [], pantry: [
    ["Składnik", "Dział", "Mam", "Zawsze mam"],
    ...["masło orzechowe", "masło", "twaróg", "pomidory", "bazylia", "ser żółty", "serek wiejski", "jogurt grecki", "olej", "makaron", "makaron udon"]
      .map(n => [n, "Inne", "FALSE", "FALSE"]),
  ] }).pantry;
  const s = (n: string) => suggestIngredient(n, pantry);

  it("gives nothing for names already in the pantry", () => {
    expect(s("Masło orzechowe")).toBeNull();
    expect(s(" jogurt grecki ")).toBeNull();
  });

  it("finds the same words in another order or without Polish letters", () => {
    expect(s("orzechowe masło")).toBe("masło orzechowe");
    expect(s("maslo orzechowe")).toBe("masło orzechowe");
    expect(s("twarog")).toBe("twaróg");
  });

  it("finds typos in longer names only", () => {
    expect(s("pomidor")).toBe("pomidory");
    expect(s("makron")).toBe("makaron");
    expect(s("olei")).toBeNull();
  });

  it("leaves one name containing the other to the similar list", () => {
    expect(s("świeża bazylia")).toBeNull();
    expect(similarIngredients("świeża bazylia", pantry)).toEqual(["bazylia"]);
    expect(similarIngredients("makaron udon świeży", pantry)).toEqual(["makaron udon", "makaron"]);
  });

  it("doesn't match different products", () => {
    expect(s("jogurt naturalny")).toBeNull();
    expect(s("serek kremowy")).toBeNull();
    expect(s("pinsa")).toBeNull();
  });

  it("lists pantry names sharing a word as similar, first word first", () => {
    expect(similarIngredients("jogurt naturalny", pantry)).toEqual(["jogurt grecki"]);
    const withJogurt = new Map(pantry).set("jogurt", { name: "jogurt", dzial: "Inne", have: false, always: false });
    expect(suggestIngredient("jogurt naturalny", withJogurt)).toBeNull();
    expect(similarIngredients("jogurt naturalny", withJogurt)).toEqual(["jogurt", "jogurt grecki"]);
    expect(similarIngredients("makaron ryżowy", pantry)).toEqual(["makaron", "makaron udon"]);
    expect(similarIngredients("żółty ser cheddar", pantry)).toEqual(["ser żółty"]);
    expect(similarIngredients("pinsa", pantry)).toEqual([]);
    expect(similarIngredients("jogurt grecki", pantry)).toEqual([]);
  });

  it("lists recipe ingredients that aren't in the pantry", () => {
    const m = parseSheet(tables());
    expect(unknownOf(m, m.recipes.find(r => r.id === "r002")!).map(i => i.name)).toEqual(["kiełbasa", "cukinia", "papryka"]);
  });
});

describe("state from the server", () => {
  it("round-trips through toState and buildModel, parsing amounts", async () => {
    const { toState, buildModel } = await import("./model");
    const sheet = parseSheet(tables(), { name: "Ania", role: "admin" });
    const m = buildModel(JSON.parse(JSON.stringify(toState(sheet))));
    expect(m.me).toEqual({ name: "Ania", role: "admin" });
    expect(m.recipes).toEqual(sheet.recipes);
    expect([...m.pantry.keys()]).toEqual([...sheet.pantry.keys()]);
    expect(m.plan).toEqual(sheet.plan);
  });
});
