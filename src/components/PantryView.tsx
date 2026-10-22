import type { FormEvent } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useState } from "react";
import { useAct, useModel } from "../data/sheet";
import { DZIALY, groupBy, norm, shoppingItems, type PantryItem } from "../model";
import { toast } from "../state/toast";
import { onlyHave, pantryQuery } from "../state/ui";
import { CheckRow, Empty } from "./common";
import { Icon } from "./Icon";

export function PantryView() {
  useSignals();
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
  const onExtra = new Set(m.extra.filter(x => !x.bought).map(x => norm(x.item)));
  const forRecipes = new Set(shoppingItems(m).map(i => norm(i.name)));

  const toggleShopping = (p: PantryItem) => {
    if (onExtra.has(norm(p.name))) { act({ action: "removeExtra", item: p.name }); toast(`Usunięto z listy zakupów: ${p.name}`); }
    else { act({ action: "addExtra", items: [p.name] }); toast(`Na liście zakupów: ${p.name}`); }
  };
  const remove = (p: PantryItem) => {
    if (!confirm(`Usunąć „${p.name}” ze spiżarni?`)) return;
    act({ action: "removePantry", name: p.name });
    toast(`Usunięto: ${p.name}`);
  };
  const actions = (p: PantryItem) => {
    const extra = onExtra.has(norm(p.name)), auto = !extra && forRecipes.has(norm(p.name));
    const label = extra ? "Usuń z listy zakupów" : auto ? "Na liście zakupów, bo brakuje do dania z listy do ugotowania" : "Dodaj do listy zakupów";
    return (
      <>
        <button type="button" className="rowbtn" disabled={auto} aria-pressed={extra || auto} aria-label={`${p.name}: ${label}`} title={label}
          onClick={() => toggleShopping(p)}><Icon name={extra || auto ? "cartDone" : "cartAdd"} /></button>
        <button type="button" className="rowbtn" aria-label={`Usuń ${p.name} ze spiżarni`} title="Usuń ze spiżarni" onClick={() => remove(p)}><Icon name="trash" /></button>
      </>
    );
  };

  const add = (e: FormEvent) => {
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
      <p className="count">Masz {haveN} z {all.length} składników. Szare pozycje zawsze są w domu i nie liczą się jako braki.</p>
      {!shown.length && <Empty>Nie ma takiego składnika. Dodaj go poniżej.</Empty>}
      {groupBy(shown, p => p.dzial).map(([d, group]) => (
        <div key={d} className="group">
          <h3>{d}</h3>
          {group.sort((a, b) => a.name.localeCompare(b.name, "pl")).map(p => p.always
            ? <CheckRow key={p.name} label={p.name} sub="zawsze mam" checked disabled>{actions(p)}</CheckRow>
            : <CheckRow key={p.name} label={p.name} checked={p.have} onChange={c => act({ action: "setPantry", name: p.name, have: c })}>{actions(p)}</CheckRow>)}
        </div>
      ))}
      <form className="panel" onSubmit={add}>
        <h3>Dodaj składnik</h3>
        <div className="row">
          <input className="field" placeholder="Nazwa, np. kasza bulgur" value={value} autoComplete="off" onChange={e => setName(e.currentTarget.value)} />
          <select className="field" aria-label="Dział" value={dzial} onChange={e => setDzial(e.currentTarget.value)}>
            {DZIALY.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <button className="btn primary" type="submit">Dodaj jako „mam”</button>
      </form>
    </>
  );
}
