import type { FormEvent } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useState } from "react";
import { extraItems } from "../actions";
import { useAct, useModel } from "../data/sheet";
import { groupBy, norm, pantryMatch, shoppingItems } from "../model";
import { toast } from "../state/toast";
import { boughtNeeds } from "../state/ui";
import { Combobox } from "./Combobox";
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

  const addExtra = (v: string) => {
    if (v.trim()) act({ action: "addExtra", items: extraItems(v.trim()) });
    setExtra("");
  };
  const onExtra = new Set(m.extra.filter(x => !x.bought).map(x => norm(x.item)));
  const suggestions = [...m.pantry.values()].map(p => p.name).filter(n => !onExtra.has(norm(n))).sort((a, b) => a.localeCompare(b, "pl"));
  const matchOf = (item: string) => pantryMatch(item, m.pantry);
  const clearBoughtExtra = () => {
    const owned = [...new Set(m.extra.filter(x => x.bought).map(x => matchOf(x.item)).filter(n => n !== null))];
    for (const name of owned) act({ action: "setPantry", name, have: true });
    act({ action: "clearBoughtExtra" });
    if (owned.length) toast(`Dodano do spiżarni: ${owned.length}`);
  };

  return (
    <>
      <div className="section mt-0">
        <h3>Brakuje do dań z listy</h3>
        {!items.length && <Empty>{anyQueued ? "Masz wszystko do dań z listy do ugotowania." : "Na liście do ugotowania nie ma dań z przepisów. Dodaj je w zakładce Plan."}</Empty>}
        {groupBy(items, i => i.dzial, m.dzialy).map(([dzial, group]) => (
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
        <form className="flex gap-2" onSubmit={(e: FormEvent) => { e.preventDefault(); addExtra(extra); }}>
          <Combobox className="min-w-0 flex-1" aria-label="Dopisz do listy" placeholder="Produkt ze spiżarni albo cokolwiek" value={extra} options={suggestions}
            onInput={setExtra} onPick={addExtra} onEnter={() => addExtra(extra)} newLabel={q => `Dopisz „${q}”`} />
          <button className="iconbtn primary" type="submit">Dodaj</button>
        </form>
        {m.extra.length
          ? m.extra.map(x => {
              const match = matchOf(x.item);
              const sub = match && (norm(match) === norm(x.item) ? "→ spiżarnia" : `→ spiżarnia: ${match}`);
              return <CheckRow key={x.uid} label={x.item} sub={sub || undefined} checked={x.bought} done={x.bought} onChange={c => act({ action: "setExtra", uid: x.uid, bought: c })} />;
            })
          : <Empty>Pusto. Dopisz coś powyżej albo dodaj składnik z zakładki Spiżarnia.</Empty>}
        {m.extra.some(x => x.bought) && <button className="btn ghost" onClick={clearBoughtExtra}>Usuń kupione z listy</button>}
        {m.extra.some(x => matchOf(x.item)) && <p className="count">Kupione produkty ze spiżarni (→) po usunięciu z listy trafiają do niej jako „mam”.</p>}
      </div>
    </>
  );
}
