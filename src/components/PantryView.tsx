import type { FormEvent } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { Fragment, useState } from "react";
import { extraItems } from "../actions";
import { useAct, useModel } from "../data/sheet";
import { groupBy, isAdmin, norm, recipesUsing, shoppingItems, type PantryItem } from "../model";
import { toast } from "../state/toast";
import { onlyHave, pantryQuery } from "../state/ui";
import { CheckRow, Empty } from "./common";
import { Icon } from "./Icon";
import { ProductEditor } from "./ProductEditor";

export function PantryView() {
  useSignals();
  const m = useModel();
  const act = useAct();
  const [dzial, setDzial] = useState<string | null>(null); // null: the first section
  const [name, setName] = useState<string | null>(null); // null: follow the search box
  const [editing, setEditing] = useState<string | null>(null); // admin: product being edited
  if (!m) return <Empty>Wczytuję spiżarnię…</Empty>;
  const q = norm(pantryQuery.value);
  const all = [...m.pantry.values()];
  const shown = all.filter(p => (!q || norm(p.name).includes(q)) && (!onlyHave.value || p.have || p.always));
  const haveN = all.filter(p => p.have).length;
  const value = name ?? pantryQuery.value;
  const section = dzial ?? m.dzialy[0];
  const onExtra = new Set(m.extra.filter(x => !x.bought).map(x => norm(x.item)));
  const forRecipes = new Set(shoppingItems(m).map(i => norm(i.name)));

  const toggleShopping = (p: PantryItem) => {
    if (onExtra.has(norm(p.name))) { act({ action: "removeExtra", item: p.name }); toast(`Usunięto z listy zakupów: ${p.name}`); }
    else { act({ action: "addExtra", items: extraItems(p.name) }); toast(`Na liście zakupów: ${p.name}`); }
  };
  const remove = (p: PantryItem) => {
    const used = recipesUsing(m, p.name);
    if (used.length) {
      const names = used.slice(0, 3).map(r => `„${r.name}”`).join(", ") + (used.length > 3 ? "…" : "");
      toast(`„${p.name}” jest w przepisach: ${names}. Usuń go z nich albo połącz z innym składnikiem (ołówek).`);
      return;
    }
    if (!confirm(`Usunąć „${p.name}” z bazy składników? Zniknie ze spiżarni wszystkich gospodarstw.`)) return;
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
        {/* the catalog is shared by all households, so only admins delete from it */}
        {isAdmin(m) && <>
          <button type="button" className="rowbtn" aria-label={`Edytuj ${p.name}`} title="Zmień nazwę, dział albo połącz" aria-expanded={editing === p.name}
            onClick={e => { e.preventDefault(); setEditing(editing === p.name ? null : p.name); }}><Icon name="edit" /></button>
          <button type="button" className="rowbtn" aria-label={`Usuń ${p.name} z bazy`} title="Usuń z bazy składników" onClick={() => remove(p)}><Icon name="trash" /></button>
        </>}
      </>
    );
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = value.trim();
    if (!n) return;
    if (m.pantry.has(n.toLowerCase())) { toast(`„${n}” już jest w spiżarni`); return; }
    act({ action: "addPantry", name: n, dzial: section });
    pantryQuery.value = "";
    setName(null);
    toast(`Dodano: ${n}`);
  };

  return (
    <>
      <p className="count">Masz {haveN} z {all.length} składników. Szare pozycje zawsze są w domu i nie liczą się jako braki.</p>
      {!shown.length && <Empty>Nie ma takiego składnika. Dodaj go poniżej.</Empty>}
      {groupBy(shown, p => p.dzial, m.dzialy).map(([d, group]) => (
        <div key={d} className="group">
          <h3>{d}</h3>
          {group.sort((a, b) => a.name.localeCompare(b.name, "pl")).map(p => (
            <Fragment key={p.name}>
              {p.always
                ? <CheckRow label={p.name} sub="zawsze mam" checked disabled>{actions(p)}</CheckRow>
                : <CheckRow label={p.name} checked={p.have} onChange={c => act({ action: "setPantry", name: p.name, have: c })}>{actions(p)}</CheckRow>}
              {editing === p.name && <ProductEditor m={m} p={p} done={() => setEditing(null)} />}
            </Fragment>
          ))}
        </div>
      ))}
      <form className="panel" onSubmit={add}>
        <h3>Dodaj składnik</h3>
        <div className="row">
          <input className="field" placeholder="Nazwa, np. kasza bulgur" value={value} autoComplete="off" onChange={e => setName(e.currentTarget.value)} />
          <select className="field" aria-label="Dział" value={section} onChange={e => setDzial(e.currentTarget.value)}>
            {m.dzialy.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <button className="btn primary" type="submit">Dodaj jako „mam”</button>
      </form>
    </>
  );
}
