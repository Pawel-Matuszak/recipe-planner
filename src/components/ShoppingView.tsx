import type { FormEvent } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useState } from "react";
import { extraItems } from "../actions";
import { useAct, useModel } from "../data/sheet";
import { groupBy, norm, shoppingItems } from "../model";
import { toast } from "../state/toast";
import { boughtNeeds } from "../state/ui";
import { CheckRow, Empty } from "./common";

export function ShoppingView() {
  useSignals();
  const m = useModel();
  const act = useAct();
  const [extra, setExtra] = useState("");
  if (!m) return <Empty>Wczytuję…</Empty>;
  const items = shoppingItems(m);
  const anyQueued = m.plan.some(p => p.id && !p.cooked);
  const bought = new Set(boughtNeeds.value);
  const isBought = (name: string) => bought.has(norm(name));
  const setBought = (name: string, on: boolean) =>
    (boughtNeeds.value = on ? [...boughtNeeds.value, norm(name)] : boughtNeeds.value.filter(x => x !== norm(name)));
  const boughtItems = items.filter(i => isBought(i.name));
  const moveBought = () => {
    for (const i of boughtItems) act({ action: "setPantry", name: i.name, have: true });
    boughtNeeds.value = [];
    toast(`Dodano do spiżarni: ${boughtItems.length}`);
  };

  const addExtra = (e: FormEvent) => {
    e.preventDefault();
    const v = extra.trim();
    if (v) { act({ action: "addExtra", items: extraItems(v) }); setExtra(""); }
  };

  return (
    <>
      <div className="section mt-0">
        <h3>Brakuje do dań z listy</h3>
        {!items.length && <Empty>{anyQueued ? "Masz wszystko do dań z listy do ugotowania." : "Na liście do ugotowania nie ma dań z przepisów. Dodaj je w zakładce Plan."}</Empty>}
        {groupBy(items, i => i.dzial).map(([dzial, group]) => (
          <div key={dzial} className="group">
            <h3>{dzial}</h3>
            {group.sort((a, b) => a.name.localeCompare(b.name, "pl")).map(it => (
              <CheckRow key={it.name} label={it.name} qty={it.total} sub={it.for.map(f => f.qty ? `${f.recipe} ${f.qty}` : f.recipe).join(" · ")} checked={isBought(it.name)} done={isBought(it.name)}
                onChange={c => setBought(it.name, c)} />
            ))}
          </div>
        ))}
        {boughtItems.length > 0 && <button className="btn ghost" onClick={moveBought}>Usuń kupione z listy</button>}
        {items.length > 0 && <p className="count">Kupione po usunięciu z listy trafiają do spiżarni jako „mam”.</p>}
      </div>
      <div className="section">
        <h3>Dopisane ręcznie</h3>
        <form className="flex gap-2" onSubmit={addExtra}>
          <input className="search-input" placeholder="Np. papier do pieczenia" autoComplete="off" enterKeyHint="done" value={extra} onChange={e => setExtra(e.currentTarget.value)} />
          <button className="iconbtn primary" type="submit">Dodaj</button>
        </form>
        {m.extra.length
          ? m.extra.map(x => <CheckRow key={x.uid} label={x.item} checked={x.bought} done={x.bought} onChange={c => act({ action: "setExtra", uid: x.uid, bought: c })} />)
          : <Empty>Pusto. Dopisz coś powyżej albo dodaj składnik z zakładki Spiżarnia.</Empty>}
        {m.extra.some(x => x.bought) && <button className="btn ghost" onClick={() => act({ action: "clearBoughtExtra" })}>Usuń kupione z listy</button>}
      </div>
    </>
  );
}
