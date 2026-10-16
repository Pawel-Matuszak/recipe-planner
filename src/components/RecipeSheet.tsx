import { useState } from "preact/hooks";
import { useAct, useModel, useRecipe } from "../data/sheet";
import { linkLabel } from "../lib/format";
import { randomPick } from "../lib/random";
import { DAYS, ingState, iso, MEALS, missingOf, weekDates, type IngState, type Recipe } from "../model";
import { toast } from "../state/toast";
import { openRecipe, randomMode } from "../state/ui";
import { MissBadge } from "./common";
import { usePlanAdd } from "./PlanView";

const ORDER: Record<IngState, number> = { miss: 0, have: 1, always: 2 };
const HINT: Record<IngState, string> = { miss: "dotknij: mam", have: "dotknij: brak", always: "zawsze" };
const MARK: Record<IngState, string> = { miss: "bg-paprika-soft text-paprika", have: "bg-basil-soft text-basil", always: "bg-line text-muted" };

function PlanIt({ r }: { r: Recipe }) {
  const dates = [...weekDates(0), ...weekDates(1)];
  const [day, setDay] = useState(iso(dates[0]));
  const [meal, setMeal] = useState(r.type === "Śniadanie" ? "Śniadanie" : "Obiad");
  const add = usePlanAdd();
  return (
    <div class="section">
      <h3>Zaplanuj</h3>
      <div class="row">
        <select class="field min-w-40 flex-2" aria-label="Dzień" value={day} onChange={e => setDay(e.currentTarget.value)}>
          {dates.map((d, k) => <option key={k} value={iso(d)}>{k < 7 ? "" : "nast. "}{DAYS[k % 7].toLowerCase()} {d.getDate()}.{String(d.getMonth() + 1).padStart(2, "0")}</option>)}
        </select>
        <select class="field" aria-label="Posiłek" value={meal} onChange={e => setMeal(e.currentTarget.value)}>
          {MEALS.map(x => <option key={x}>{x}</option>)}
        </select>
      </div>
      <button class="btn primary" onClick={() => add(day, meal, r.id, "")}>Dodaj do planu</button>
    </div>
  );
}

export function RecipeSheet() {
  const m = useModel();
  const r = useRecipe(openRecipe.value);
  const act = useAct();
  if (!r || !m) return null;
  const miss = missingOf(m, r);
  const ings = r.ing.map(i => ({ i, st: ingState(m, i) })).sort((a, b) => ORDER[a.st] - ORDER[b.st]);
  const setField = (field: "done" | "rate" | "notes", value: boolean | number | string) =>
    act({ action: "setRecipeField", by: r.by, key: r.key, field, value });
  const close = () => { openRecipe.value = null; randomMode.value = false; };

  return (
    <div class="wrap pt-3 pb-10">
      <div class="sticky top-0 z-[2] flex min-h-14 items-center justify-between gap-2 bg-bg py-2">
        <button class="btn ghost" onClick={close}>‹ Wróć</button>
        {randomMode.value && <button class="btn primary" onClick={() => randomPick(m)}>Losuj jeszcze raz</button>}
      </div>
      <h2>{r.name}</h2>
      <div class="row mt-2.5">
        <MissBadge m={m} r={r} />
        {r.time > 0 && <span class="badge b-unk">{r.time} min</span>}
        {r.diff && <span class="badge b-unk">{r.diff}</span>}
        {r.ing.length > 0 && !r.ver && <span class="badge b-warn">składniki do sprawdzenia</span>}
      </div>
      {r.links.length > 0 && (
        <div class="row mt-2.5">
          {r.links.map((l, k) => (
            <a key={l} class="btn primary" href={/^https?:/i.test(l) ? l : "https://" + l} target="_blank" rel="noopener">
              {linkLabel(l)}{r.links.length > 1 ? " " + (k + 1) : ""} ↗
            </a>
          ))}
        </div>
      )}

      <div class="section">
        <h3>Składniki{r.ing.length ? ` · ${r.ing.length}` : ""}</h3>
        {r.ing.length
          ? ings.map(({ i, st }) => (
            <button key={i} class="flex w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2.5 text-left" disabled={st === "always"}
              onClick={() => act({ action: "setPantry", name: i, have: st === "miss" })}>
              <span class={`grid size-6 flex-none place-items-center rounded-full text-[.85rem] font-extrabold ${MARK[st]}`}>{st === "miss" ? "✕" : "✓"}</span>
              <span class="min-w-0 flex-1">{i}</span>
              <span class="text-[.75rem] text-muted">{HINT[st]}</span>
            </button>
          ))
          : <div class="empty">Brak listy składników. Dopisz je w arkuszu w kolumnie „Składniki”, rozdzielając średnikami.</div>}
        {miss.length > 0 && (
          <button class="btn" onClick={() => { act({ action: "addExtra", items: miss }); toast(`Na liście zakupów: +${miss.length}`); }}>
            Brakujące na listę zakupów ({miss.length})
          </button>
        )}
      </div>

      <PlanIt key={r.id} r={r} />

      <div class="section">
        <h3>Po zrobieniu</h3>
        <label class="flex items-center gap-2.5 font-bold">
          <input type="checkbox" class="size-[22px] accent-basil" checked={r.done} onChange={e => setField("done", e.currentTarget.checked)} /> Było robione
        </label>
        <div class="flex gap-0.5" role="group" aria-label="Ocena">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} class={`p-1 text-[1.7rem] leading-none ${n <= r.rate ? "text-saffron" : "text-line"}`} aria-label={`${n} na 5`}
              onClick={() => setField("rate", n === r.rate ? "" : n)}>★</button>
          ))}
        </div>
        <textarea key={r.id} class="min-h-[84px] w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2.5"
          placeholder="Notatka na następny raz, np. mniej soli, podwójny sos" defaultValue={r.notes}
          onChange={e => { const v = e.currentTarget.value; if (v !== r.notes) { setField("notes", v); toast("Notatka zapisana"); } }} />
      </div>
      <p class="count">{r.type}{r.cats.length ? " · " + r.cats.join(", ") : ""}</p>
    </div>
  );
}
