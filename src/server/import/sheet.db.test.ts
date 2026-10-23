import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { demoTables } from "../../mock";
import { parseSheet } from "../../model";
import { createDb, truncateAll } from "../db";
import { importSheet, tablesOf, verifyImport } from "./sheet";

const db = createDb();
const sheet = parseSheet(demoTables());
const user = (email: string) => db.user.create({ data: { id: email, name: email, email } });

beforeEach(() => truncateAll(db));
afterAll(() => db.$disconnect());

describe("importSheet", () => {
  it("creates the owner's household and loads a faithful copy of the sheet", async () => {
    await user("ania@example.com");
    const r = await importSheet(db, sheet, "Ania@Example.com");
    expect(r).toMatchObject({ created: true, counts: { recipes: 10, plan: 5, extras: 1 } });
    expect(await verifyImport(db, r.householdId, sheet)).toEqual([]);
  });

  it("can run again: replaces the catalog and the household's kitchen, keeps accounts and members", async () => {
    await user("ania@example.com");
    await user("bartek@example.com");
    const first = await importSheet(db, sheet, "ania@example.com");
    await db.householdMember.create({ data: { householdId: first.householdId, userId: "bartek@example.com", role: "member" } });

    const changed = demoTables();
    changed.main.splice(10, 1); // one recipe fewer
    changed.extra.push(["folia", "TRUE"]);
    const again = parseSheet(changed);
    const second = await importSheet(db, again, "ania@example.com");

    expect(second).toMatchObject({ householdId: first.householdId, created: false, counts: { recipes: 9, extras: 2 } });
    expect(await db.householdMember.count()).toBe(2);
    expect(await verifyImport(db, second.householdId, again)).toEqual([]);
  });

  it("refuses to erase another household's kitchen, or to import for someone without an account", async () => {
    await user("ania@example.com");
    await user("bartek@example.com");
    await importSheet(db, sheet, "bartek@example.com");
    await expect(importSheet(db, sheet, "ania@example.com")).rejects.toThrow(/1 other household/);
    await expect(importSheet(db, sheet, "nikt@example.com")).rejects.toThrow(/Sign up/);
  });

  it("notices when the database doesn't match the sheet", async () => {
    await user("ania@example.com");
    const { householdId } = await importSheet(db, sheet, "ania@example.com");
    // kiełbasa is needed for Leczo, which is planned and not cooked yet
    await db.pantryItem.updateMany({ where: { householdId, ingredient: { nameNorm: "kiełbasa" } }, data: { have: true } });
    const diffs = await verifyImport(db, householdId, sheet);
    expect(diffs.some(d => d.startsWith("pantry ticks"))).toBe(true);
    expect(diffs.some(d => d.startsWith("shopping list: missing kiełbasa|Mięso i ryby|400 g|Leczo:400 g"))).toBe(true);
  });
});

describe("tablesOf", () => {
  it("accepts the Apps Script answer or its data, and reports its errors", () => {
    const t = demoTables();
    expect(tablesOf({ ok: true, data: t })).toBe(t);
    expect(tablesOf(t)).toBe(t);
    expect(() => tablesOf({ error: "unauthorized" })).toThrow("Apps Script: unauthorized");
    expect(() => tablesOf({ main: [] })).toThrow(/pantry/);
  });
});
