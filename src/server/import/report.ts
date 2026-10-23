// What to fix in the spreadsheet before importing it. Pure: reads the raw tabs and their parsed Model.
// Errors stop the import (it would fail or lose data); warnings are worth a look but import as described.
import { norm, similarIngredients, suggestIngredient, type Model, type PantryItem, type Tables } from "../../model";

export interface SheetReport { errors: string[]; warnings: string[] }

const dupes = (xs: string[]) => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))];

export function sheetReport(t: Tables, m: Model): SheetReport {
  const errors: string[] = [], warnings: string[] = [];

  const ids = m.recipes.map(r => r.id).filter(id => !id.startsWith("#"));
  for (const id of dupes(ids)) errors.push(`Main: ID "${id}" is used by ${m.recipes.filter(r => r.id === id).map(r => r.name).join(", ")}.`);
  for (const r of m.recipes.filter(r => r.id.startsWith("#"))) warnings.push(`Main: "${r.name}" has no ID; plan rows can't point at it.`);
  for (const name of dupes(m.recipes.map(r => norm(r.name)))) warnings.push(`Main: "${name}" appears more than once.`);

  const pantryNames = t.pantry.slice(1).map(r => norm(r[0])).filter(Boolean);
  for (const name of dupes(pantryNames)) warnings.push(`Spiżarnia: "${name}" appears more than once; only the last row is kept.`);

  // likely typos within the pantry itself: each product compared with all the others
  const seen = new Set<string>();
  for (const [key, p] of m.pantry) {
    const others = new Map<string, PantryItem>([...m.pantry].filter(([k]) => k !== key));
    const twin = suggestIngredient(p.name, others);
    if (twin && !seen.has(norm(twin))) warnings.push(`Spiżarnia: "${p.name}" looks like "${twin}"; merge them if they're the same product.`);
    seen.add(key);
  }

  // recipe ingredients missing from the pantry become new products ("Inne") unless they're a typo of an existing one
  const unknown = new Map<string, string[]>();
  for (const r of m.recipes) for (const i of r.ing) {
    if (norm(i.name) && !m.pantry.has(norm(i.name))) unknown.set(i.name.trim(), [...(unknown.get(i.name.trim()) ?? []), r.name]);
  }
  for (const [name, recipes] of [...unknown].sort(([a], [b]) => a.localeCompare(b, "pl"))) {
    const typo = suggestIngredient(name, m.pantry);
    const like = typo ? [] : similarIngredients(name, m.pantry);
    const hint = typo ? `probably "${typo}"` : like.length ? `similar: ${like.map(s => `"${s}"`).join(", ")}` : "new product";
    warnings.push(`Poza bazą: "${name}" (${recipes.join(", ")}): ${hint}.`);
  }

  for (const r of m.recipes) {
    const rate = r.rate;
    if (rate && (rate < 1 || rate > 5)) warnings.push(`Main: "${r.name}" has rating ${rate}; only 1–5 is kept.`);
    if (r.diff && !["łatwy", "średni", "trudny"].includes(norm(r.diff))) warnings.push(`Main: "${r.name}" has difficulty "${r.diff}", which isn't Łatwy/Średni/Trudny; it's dropped.`);
  }

  const known = new Set(m.recipes.map(r => r.id));
  for (const p of m.plan) if (p.id && !known.has(p.id)) warnings.push(`Plan2: ${p.date} points at recipe "${p.id}", which doesn't exist; kept as text.`);
  const undated = t.plan.slice(1).filter(r => String(r[0] ?? "").trim() === "" && (String(r[2] ?? "").trim() || String(r[3] ?? "").trim()));
  if (undated.length) warnings.push(`Plan2: ${undated.length} row(s) without a date are skipped.`);

  return { errors, warnings };
}
