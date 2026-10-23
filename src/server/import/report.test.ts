import { describe, expect, it } from "vitest";
import { demoTables } from "../../mock";
import { parseSheet, type Tables } from "../../model";
import { sheetReport } from "./report";

const report = (t: Tables) => sheetReport(t, parseSheet(t));

describe("sheetReport", () => {
  it("finds nothing wrong with the demo sheet", () => {
    expect(report(demoTables())).toEqual({ errors: [], warnings: [] });
  });

  it("stops on a recipe ID used twice", () => {
    const t = demoTables();
    t.main[2][9] = "r001";
    expect(report(t).errors).toEqual([`Main: ID "r001" is used by Carbonara, Leczo.`]);
  });

  it("points out typos and unknown products, once per pair", () => {
    const t = demoTables();
    t.pantry.push(["Parmezn", "Nabiał i jajka", "FALSE", "FALSE"], ["masło", "Inne", "FALSE", "FALSE"]);
    t.main[1][11] = "makaron: 200 g; boczk: 150 g; szafran";
    const { warnings } = report(t);
    expect(warnings).toContain(`Spiżarnia: "masło" appears more than once; only the last row is kept.`);
    expect(warnings.filter(w => w.includes("Parmezn"))).toEqual([`Spiżarnia: "parmezan" looks like "Parmezn"; merge them if they're the same product.`]);
    expect(warnings).toContain(`Poza bazą: "boczk" (Carbonara): probably "boczek".`);
    expect(warnings).toContain(`Poza bazą: "szafran" (Carbonara): new product.`);
  });

  it("warns about values the database can't keep and plan rows that lose their recipe", () => {
    const t = demoTables();
    t.main[1][13] = "7";
    t.main[2][3] = "Banalny";
    t.plan.push(["2030-01-01", "", "r999", "", "FALSE"], ["", "", "r001", "", "FALSE"]);
    expect(report(t).warnings).toEqual([
      `Main: "Carbonara" has rating 7; only 1–5 is kept.`,
      `Main: "Leczo" has difficulty "Banalny", which isn't Łatwy/Średni/Trudny; it's dropped.`,
      `Plan2: 2030-01-01 points at recipe "r999", which doesn't exist; kept as text.`,
      `Plan2: 1 row(s) without a date are skipped.`,
    ]);
  });
});
