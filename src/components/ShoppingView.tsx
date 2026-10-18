import { useState } from "preact/hooks";
import { useAct, useModel } from "../data/sheet";
import { groupBy, norm, shoppingItems } from "../model";
import { toast } from "../state/toast";
import { boughtNeeds } from "../state/ui";
import { CheckRow, Empty } from "./common";

export function ShoppingView() {
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

  const addExtra = (e: Event) => {
    e.preventDefault();
    const v = extra.trim();
    if (v) { act({ action: "addExtra", items: [v] }); setExtra(""); }
  };

  return (
    <>
      <div class="section mt-0">
        <h3>Brakuje do dań z listy</h3>
        {!items.length && <Empty>{anyQueued ? "Masz wszystko do dań z listy do ugotowania." : "Na liście do ugotowania nie ma dań z przepisów. Dodaj je w zakładce Plan."}</Empty>}
        {groupBy(items, i => i.dzial).map(([dzial, group]) => (
          <div key={dzial} class="group">
            <h3>{dzial}</h3>
            {group.sort((a, b) => a.name.localeCompare(b.name, "pl")).map(it => (
              <CheckRow key={it.name} label={it.name} qty={it.total} sub={it.for.map(f => f.qty ? `${f.recipe} ${f.qty}` : f.recipe).join(" · ")} checked={isBought(it.name)} done={isBought(it.name)}
                onChange={c => setBought(it.name, c)} />
            ))}
          </div>
        ))}
        {boughtItems.length > 0 && <button class="btn ghost" onClick={moveBought}>Usuń kupione z listy</button>}
        {items.length > 0 && <p class="count">Kupione po usunięciu z listy trafiają do spiżarni jako „mam”.</p>}
      </div>
      <div class="section">
        <h3>Dopisane ręcznie</h3>
        <form class="flex gap-2" onSubmit={addExtra}>
          <input class="search-input" placeholder="Np. papier do pieczenia" autocomplete="off" enterkeyhint="done" value={extra} onInput={e => setExtra(e.currentTarget.value)} />
          <button class="iconbtn primary" type="submit">Dodaj</button>
        </form>
        {m.extra.length
          ? m.extra.map((x, k) => <CheckRow key={k} label={x.item} checked={x.bought} done={x.bought} onChange={c => act({ action: "setExtra", item: x.item, bought: c })} />)
          : <Empty>Pusto. Dopisz coś powyżej albo dodaj składnik z zakładki Spiżarnia.</Empty>}
        {m.extra.some(x => x.bought) && <button class="btn ghost" onClick={() => act({ action: "clearBoughtExtra" })}>Usuń kupione z listy</button>}
      </div>
    </>
  );
}
