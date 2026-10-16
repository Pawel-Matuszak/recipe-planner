import { useState } from "preact/hooks";
import { useAct, useModel } from "../data/sheet";
import { DZIALY, groupBy, norm } from "../model";
import { toast } from "../state/toast";
import { onlyHave, pantryQuery } from "../state/ui";
import { CheckRow, Empty } from "./common";

export function PantryView() {
  const m = useModel();
  const act = useAct();
  const [dzial, setDzial] = useState(DZIALY[0]);
  const [name, setName] = useState<string | null>(null); // null: follow the search box
  if (!m) return <Empty>Wczytuję spiżarnię…</Empty>;
  const q = norm(pantryQuery.value);
  const all = [...m.pantry.values()];
  const shown = all.filter(p => (!q || norm(p.name).includes(q)) && (!onlyHave.value || p.have || p.always));
  const haveN = all.filter(p => p.have).length;
  const value = name ?? pantryQuery.value;

  const add = (e: Event) => {
    e.preventDefault();
    const n = value.trim();
    if (!n) return;
    if (m.pantry.has(n.toLowerCase())) { toast(`„${n}” już jest w spiżarni`); return; }
    act({ action: "addPantry", name: n, dzial });
    pantryQuery.value = "";
    setName(null);
    toast(`Dodano: ${n}`);
  };

  return (
    <>
      <p class="count">Masz {haveN} z {all.length} składników. Szare pozycje zawsze są w domu i nie liczą się jako braki.</p>
      {!shown.length && <Empty>Nie ma takiego składnika. Dodaj go poniżej.</Empty>}
      {groupBy(shown, p => p.dzial).map(([d, group]) => (
        <div key={d} class="group">
          <h3>{d}</h3>
          {group.sort((a, b) => a.name.localeCompare(b.name, "pl")).map(p => p.always
            ? <CheckRow key={p.name} label={p.name} sub="zawsze mam" checked disabled />
            : <CheckRow key={p.name} label={p.name} checked={p.have} onChange={c => act({ action: "setPantry", name: p.name, have: c })} />)}
        </div>
      ))}
      <form class="panel" onSubmit={add}>
        <h3>Dodaj składnik</h3>
        <div class="row">
          <input class="field" placeholder="Nazwa, np. kasza bulgur" value={value} autocomplete="off" onInput={e => setName(e.currentTarget.value)} />
          <select class="field" aria-label="Dział" value={dzial} onChange={e => setDzial(e.currentTarget.value)}>
            {DZIALY.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <button class="btn primary" type="submit">Dodaj jako „mam”</button>
      </form>
    </>
  );
}
