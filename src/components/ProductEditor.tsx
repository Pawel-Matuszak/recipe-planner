import { useSignals } from "@preact/signals-react/runtime";
import { useState } from "react";
import { useAct } from "../data/sheet";
import { DZIALY, norm, type Model, type PantryItem } from "../model";
import { toast } from "../state/toast";

/** Admin: rename a product, move it to another section, or merge it into another product (for duplicates and typos). */
export function ProductEditor({ m, p, done }: { m: Model; p: PantryItem; done: () => void }) {
  useSignals();
  const act = useAct();
  const [name, setName] = useState(p.name);
  const [dzial, setDzial] = useState(p.dzial);
  const [into, setInto] = useState("");
  const sections = [...new Set([...DZIALY, p.dzial])];
  const uses = m.recipes.filter(r => r.ing.some(i => norm(i.name) === norm(p.name))).length;
  const taken = norm(name) !== norm(p.name) && m.pantry.has(norm(name));
  const target = m.pantry.get(norm(into));

  const save = () => {
    const newName = name.trim();
    if (!newName) return toast("Podaj nazwę");
    if (taken) return toast(`„${newName}” już jest w bazie. Połącz je poniżej.`);
    if (newName === p.name && dzial === p.dzial) return done();
    act({ action: "editIngredient", name: p.name, ...(newName !== p.name && { newName }), ...(dzial !== p.dzial && { dzial }) });
    toast(`Zapisano: ${newName}`);
    done();
  };
  const merge = () => {
    if (!target || target.name === p.name) return toast("Wybierz inny składnik z bazy");
    if (!confirm(`Połączyć „${p.name}” z „${target.name}”? „${p.name}” zniknie z bazy, a przepisy będą używać „${target.name}”.`)) return;
    act({ action: "mergeIngredients", from: p.name, into: target.name });
    toast(`Połączono z: ${target.name}`);
    done();
  };

  return (
    <div className="panel mt-1 mb-2">
      <p className="text-[.85rem] text-muted">Baza składników jest wspólna dla wszystkich gospodarstw. {uses ? `Używany w ${uses} przepisach.` : "Nie jest w żadnym przepisie."}</p>
      <div className="row">
        <input className="field" aria-label="Nazwa" value={name} onChange={e => setName(e.currentTarget.value)} autoComplete="off" />
        <select className="field" aria-label="Dział" value={dzial} onChange={e => setDzial(e.currentTarget.value)}>
          {sections.map(d => <option key={d}>{d}</option>)}
        </select>
      </div>
      {taken && <p className="text-[.85rem] text-paprika">„{name.trim()}” już jest w bazie. Żeby mieć jeden składnik, połącz je poniżej.</p>}
      <div className="row">
        <button className="btn primary" onClick={save}>Zapisz</button>
        <button className="btn ghost" onClick={done}>Anuluj</button>
      </div>
      <h3 className="mt-2">Połącz z innym składnikiem</h3>
      <p className="text-[.85rem] text-muted">Dla duplikatów i literówek: „{p.name}” zniknie, a jego przepisy i zaznaczenia przejdą na wybrany składnik.</p>
      <div className="row">
        <input className="field" list="merge-names" aria-label="Połącz z" placeholder="np. pomidory" value={into} onChange={e => setInto(e.currentTarget.value)} autoComplete="off" />
        <button className="btn ghost" disabled={!target || target.name === p.name} onClick={merge}>Połącz</button>
      </div>
      <datalist id="merge-names">{[...m.pantry.values()].filter(x => x.name !== p.name).map(x => <option key={x.name} value={x.name} />)}</datalist>
    </div>
  );
}
