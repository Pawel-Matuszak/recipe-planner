import { useSignals } from "@preact/signals-react/runtime";
import { useMemo } from "react";
import { useModel } from "../data/sheet";
import { filterRecipes, plural, type Model, type Recipe } from "../model";
import { filters, openRecipe, randomMode } from "../state/ui";
import { Empty, MissBadge } from "./common";

function RecipeCard({ m, r }: { m: Model; r: Recipe }) {
  useSignals();
  const idea = r.cats.includes("Pomysł");
  const meta = [
    r.time ? `${r.time} min` : "", r.diff, r.type, ...r.cats.filter(c => c !== "Pomysł"),
    r.done ? "✓ robione" : "", idea ? "pomysł" : "", r.rate ? "★".repeat(r.rate) : "",
  ].filter(Boolean);
  return (
    <button className="card" onClick={() => { randomMode.value = false; openRecipe.value = r.id; }}>
      <span className="min-w-0 text-[1.02rem] font-bold wrap-anywhere">{r.name}</span>
      <MissBadge m={m} r={r} />
      <span className="col-span-full flex flex-wrap gap-x-2.5 gap-y-1 text-[.82rem] text-muted tabular-nums">{meta.map((x, i) => <span key={i}>{x}</span>)}</span>
    </button>
  );
}

export function RecipesView() {
  useSignals();
  const m = useModel();
  const f = filters.value;
  const list = useMemo(() => (m ? filterRecipes(m, f) : []), [m, f]);
  if (!m) return <Empty>Wczytuję przepisy…</Empty>;
  return (
    <>
      <p className="count">{list.length} {plural(list.length, "przepis", "przepisy", "przepisów")}{f.can ? " · od najmniejszej liczby braków" : ""}</p>
      {list.length
        ? <div className="list">{list.map(r => <RecipeCard key={r.id} m={m} r={r} />)}</div>
        : <Empty>Nic nie pasuje do filtrów. Wyłącz któryś filtr albo zmień wyszukiwanie.</Empty>}
    </>
  );
}
