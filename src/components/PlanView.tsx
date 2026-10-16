import { useState } from "preact/hooks";
import { useAct, useModel } from "../data/sheet";
import { dayName, fmtDay } from "../lib/format";
import { DAYS, iso, MEALS, norm, weekDates, type Model } from "../model";
import { toast } from "../state/toast";
import { openRecipe, pickFor, pickMeal, randomMode, week } from "../state/ui";
import { Empty, MissBadge, WeekNav } from "./common";

export function usePlanAdd() {
  const act = useAct();
  return (date: string, meal: string, id: string, text: string) => {
    act({ action: "addPlan", date, meal, id, text });
    toast(`Dodano do planu: ${dayName(date).toLowerCase()}, ${meal.toLowerCase()}`);
  };
}

function MealPicker({ m, date }: { m: Model; date: string }) {
  const [q, setQ] = useState("");
  const add = usePlanAdd();
  const nq = norm(q);
  const opts = m.recipes.filter(r => !r.arch && (!nq || norm(r.name).includes(nq))).slice(0, 8);
  const done = (id: string, text: string) => { add(date, pickMeal.value, id, text); pickFor.value = null; };
  return (
    <div class="panel mt-0">
      <select class="field" aria-label="Posiłek" value={pickMeal.value} onChange={e => (pickMeal.value = e.currentTarget.value)}>
        {MEALS.map(x => <option key={x}>{x}</option>)}
      </select>
      <input class="field" placeholder="Wpisz nazwę dania…" value={q} autocomplete="off" autoFocus onInput={e => setQ(e.currentTarget.value)} />
      <div class="list">
        {opts.map(r => (
          <button key={r.id} class="card" onClick={() => done(r.id, "")}><span class="font-bold">{r.name}</span><MissBadge m={m} r={r} /></button>
        ))}
      </div>
      <div class="row">
        {nq && <button class="btn" onClick={() => done("", q.trim())}>Dodaj jako tekst: „{q}”</button>}
        <button class="btn ghost" onClick={() => (pickFor.value = null)}>Anuluj</button>
      </div>
    </div>
  );
}

export function PlanView() {
  const m = useModel();
  const act = useAct();
  if (!m) return <Empty>Wczytuję plan…</Empty>;
  const today = iso(new Date());
  return (
    <>
      <WeekNav />
      <div class="list mt-2.5">
        {weekDates(week.value).map((d, i) => {
          const ds = iso(d);
          const items = m.plan.map((p, k) => ({ ...p, k })).filter(p => p.date === ds).sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
          return (
            <section key={ds} class={`grid gap-2 rounded-card border bg-surface px-3.5 py-3 ${ds === today ? "border-basil" : "border-line"}`}>
              <div class="flex items-baseline justify-between gap-2">
                <b class="font-display text-[1.05rem]">{DAYS[i]}</b>
                <span class="text-[.82rem] text-muted tabular-nums">{fmtDay(d)}{ds === today ? " · dziś" : ""}</span>
              </div>
              {items.map(p => {
                const r = p.id ? m.recipes.find(x => x.id === p.id) : undefined;
                return (
                  <div key={p.k} class="grid grid-cols-[84px_1fr_auto] items-center gap-2 text-[.95rem]">
                    <span class="text-[.74rem] font-bold tracking-[.06em] text-muted uppercase">{p.meal}</span>
                    {r
                      ? <button class="min-w-0 text-left font-bold text-basil underline underline-offset-3 wrap-anywhere" onClick={() => { randomMode.value = false; openRecipe.value = r.id; }}>{r.name}</button>
                      : <span class="min-w-0 wrap-anywhere">{p.text || p.id}</span>}
                    <button class="size-9 rounded-full text-[1.2rem] text-muted" aria-label="Usuń z planu"
                      onClick={() => act({ action: "removePlan", date: p.date, meal: p.meal, id: p.id, text: p.text })}>×</button>
                  </div>
                );
              })}
              {pickFor.value === ds
                ? <MealPicker m={m} date={ds} />
                : <button class="w-full rounded-[10px] border border-dashed border-line p-2 font-bold text-muted" onClick={() => (pickFor.value = ds)}>+ dodaj posiłek</button>}
            </section>
          );
        })}
      </div>
    </>
  );
}
