import { useState } from "preact/hooks";
import { useAct, useModel } from "../data/sheet";
import { groupBy, iso, shoppingItems, weekDates } from "../model";
import { toast } from "../state/toast";
import { week } from "../state/ui";
import { CheckRow, Empty, WeekNav } from "./common";

export function ShoppingView() {
  const m = useModel();
  const act = useAct();
  const [extra, setExtra] = useState("");
  if (!m) return <Empty>Wczytuję…</Empty>;
  const dates = weekDates(week.value).map(iso);
  const items = shoppingItems(m, dates);
  const anyPlanned = m.plan.some(p => dates.includes(p.date) && p.id);

  const addExtra = (e: Event) => {
    e.preventDefault();
    const v = extra.trim();
    if (v) { act({ action: "addExtra", items: [v] }); setExtra(""); }
  };

  return (
    <>
      <WeekNav prefix="Plan " />
      <div class="section">
        <h3>Brakuje do zaplanowanych dań</h3>
        {!items.length && <Empty>{anyPlanned ? "Masz wszystko do dań z planu na ten tydzień." : "W planie na ten tydzień nie ma dań z przepisów. Dodaj je w zakładce Plan."}</Empty>}
        {groupBy(items, i => i.dzial).map(([dzial, group]) => (
          <div key={dzial} class="group">
            <h3>{dzial}</h3>
            {group.sort((a, b) => a.name.localeCompare(b.name, "pl")).map(it => (
              <CheckRow key={it.name} label={it.name} sub={`do: ${it.for.join(", ")}`}
                onChange={() => {
                  toast(`${it.name}: kupione`);
                  setTimeout(() => act({ action: "setPantry", name: it.name, have: true }), 300); // let the tick show before the row goes
                }} />
            ))}
          </div>
        ))}
        {items.length > 0 && <p class="count">Odhaczenie oznacza składnik jako „mam” w spiżarni.</p>}
      </div>
      <div class="section">
        <h3>Dopisane ręcznie</h3>
        <form class="flex gap-2" onSubmit={addExtra}>
          <input class="search-input" placeholder="Np. papier do pieczenia" autocomplete="off" enterkeyhint="done" value={extra} onInput={e => setExtra(e.currentTarget.value)} />
          <button class="iconbtn primary" type="submit">Dodaj</button>
        </form>
        {m.extra.length
          ? m.extra.map((x, k) => <CheckRow key={k} label={x.item} checked={x.bought} done={x.bought} onChange={c => act({ action: "setExtra", item: x.item, bought: c })} />)
          : <Empty>Pusto. Dopisz coś powyżej albo w przepisie użyj „Brakujące na listę zakupów”.</Empty>}
        {m.extra.some(x => x.bought) && <button class="btn ghost" onClick={() => act({ action: "clearBoughtExtra" })}>Usuń kupione z listy</button>}
      </div>
    </>
  );
}
