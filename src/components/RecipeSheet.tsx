import { useSignals } from "@preact/signals-react/runtime";
import { useState } from "react";
import type { Action } from "../actions";
import { useAct, useModel, useRecipe } from "../data/sheet";
import { linkLabel } from "../lib/format";
import { randomPick } from "../lib/random";
import { DZIALY, ingState, isAdmin, norm, parseIng, similarIngredients, splitIng, suggestIngredient, sumQty, type IngState, type Model, type Recipe } from "../model";
import { toast } from "../state/toast";
import { openRecipe, randomMode } from "../state/ui";
import { MissBadge } from "./common";
import { useQueueAdd } from "./PlanView";

const ORDER: Record<IngState, number> = { miss: 0, have: 1, always: 2 };
const MARK: Record<IngState, string> = { miss: "bg-paprika-soft text-paprika", have: "bg-basil-soft text-basil", always: "bg-line text-muted" };

function QueueIt({ m, r }: { m: Model; r: Recipe }) {
  useSignals();
  const add = useQueueAdd();
  const queued = m.plan.some(p => p.id === r.id && !p.cooked);
  return (
    <div className="section">
      <h3>Do ugotowania</h3>
      <button className="btn primary" disabled={queued} onClick={() => add(r.id, "")}>{queued ? "Już na liście do ugotowania" : "Dodaj do ugotowania"}</button>
    </div>
  );
}

const FIELD_CLS = "w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2.5";
const lines = (s: string) => s.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
// textareas grow with their content so the whole recipe is visible without inner scrolling
const rowsFor = (s: string, min: number) => Math.max(min, s.split("\n").length + 1);
const ingText = (r: Recipe) => r.ing.map(i => (i.qty ? `${i.name}: ${i.qty.raw}` : i.name)).join("\n");

/** Names in the ingredient field that aren't in the pantry: swap one for a close pantry name or add it as a new product. */
function UnknownIngredients({ m, text, setText }: { m: Model; text: string; setText: (s: string) => void }) {
  useSignals();
  const act = useAct();
  const [fresh, setFresh] = useState<string[]>([]); // marked "To nowy składnik", so no more suggestion
  const [dzial, setDzial] = useState<Record<string, string>>({});
  const all = splitIng(lines(text).join("; ")).map(i => parseIng(i).name);
  const names = [...new Map(all.map(n => [norm(n), n])).values()].filter(n => !m.pantry.has(norm(n)));
  if (!names.length) return null;

  // keeps the amount and the separators around the name as they were
  const swap = (from: string, to: string) => setText(text.split("\n").map(l => l.split(";").map(part => {
    if (norm(parseIng(part).name) !== norm(from)) return part;
    const c = part.lastIndexOf(":");
    return part.match(/^\s*/)![0] + to + (c < 0 ? "" : part.slice(c));
  }).join(";")).join("\n"));
  const add = (n: string) => {
    act({ action: "addPantry", name: n, dzial: dzial[norm(n)] ?? "Inne", have: false });
    toast(`Dodano do bazy: ${n}`);
  };

  return (
    <div className="mt-2.5 grid gap-2">
      <p className="text-[.85rem] text-muted">Tych nazw nie ma w spiżarni. Zamień na istniejącą albo dodaj jako nowy składnik.</p>
      {names.map(n => {
        const isNew = fresh.includes(norm(n));
        const s = isNew ? null : suggestIngredient(n, m.pantry);
        const similar = isNew || s ? [] : similarIngredients(n, m.pantry);
        return (
          <div key={norm(n)} className="grid gap-2 rounded-[10px] border border-paprika-soft bg-surface px-3 py-2.5">
            <span className="font-bold text-paprika">{n}</span>
            {s
              ? <>
                <span>Czy chodziło o „{s}”?</span>
                <div className="row">
                  <button className="btn primary" onClick={() => swap(n, s)}>Zamień na „{s}”</button>
                  <button className="btn ghost" onClick={() => setFresh([...fresh, norm(n)])}>To nowy składnik</button>
                </div>
              </>
              : <>
                {similar.length > 0 && <>
                  <span>Podobne w bazie:</span>
                  <div className="row">
                    {similar.map(x => <button key={x} className="btn ghost" onClick={() => swap(n, x)}>Zamień na „{x}”</button>)}
                  </div>
                  <span className="text-[.85rem] text-muted">Albo dodaj jako nowy składnik:</span>
                </>}
                <div className="row">
                  <select className="field" aria-label={`Dział: ${n}`} value={dzial[norm(n)] ?? "Inne"} onChange={e => setDzial({ ...dzial, [norm(n)]: e.currentTarget.value })}>
                    {DZIALY.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <button className="btn primary" onClick={() => add(n)}>Dodaj do bazy</button>
                </div>
              </>}
          </div>
        );
      })}
    </div>
  );
}

/** Edits the description, steps (one per line) and ingredients (one per line, "name: amount"). */
function RecipeEditor({ m, r, done }: { m: Model; r: Recipe; done: () => void }) {
  useSignals();
  const act = useAct();
  const [desc, setDesc] = useState(r.desc);
  const [steps, setSteps] = useState(r.steps.join("\n"));
  const [ing, setIng] = useState(ingText(r));
  const [next, setNext] = useState(""); // "add ingredient" box with pantry names as suggestions
  const save = () => {
    const newIng = lines(ing).join("; ");
    act({
      action: "editRecipe", recipeId: r.id, desc: desc.trim(), steps: lines(steps).join("\n"),
      // only resend ingredients when they changed, so fixing a step doesn't mark them as checked
      ...(newIng !== lines(ingText(r)).join("; ") && { ing: newIng }),
    });
    toast("Przepis zapisany");
    done();
  };

  return (
    <>
      <div className="section">
        <h3><label htmlFor="ed-desc">Opis</label></h3>
        <textarea id="ed-desc" className={FIELD_CLS} rows={rowsFor(desc, 3)} value={desc} onChange={e => setDesc(e.currentTarget.value)} />
      </div>
      <div className="section">
        <h3><label htmlFor="ed-ing">Składniki</label></h3>
        <p className="text-[.85rem] text-muted">Jeden w linii, ilość po dwukropku, np. „makaron: 200 g”.</p>
        <textarea id="ed-ing" className={FIELD_CLS} rows={rowsFor(ing, 5)} value={ing} onChange={e => setIng(e.currentTarget.value)} />
        <form className="row mt-2" onSubmit={e => { e.preventDefault(); if (next.trim()) { setIng([...lines(ing), next.trim()].join("\n")); setNext(""); } }}>
          <input className="field flex-1" list="pantry-names" aria-label="Nowy składnik" placeholder="np. masło: 50 g" autoComplete="off"
            value={next} onChange={e => setNext(e.currentTarget.value)} />
          <button className="btn ghost" type="submit">Dodaj</button>
        </form>
        <datalist id="pantry-names">{[...m.pantry.values()].map(p => <option key={p.name} value={p.name} />)}</datalist>
        <UnknownIngredients m={m} text={ing} setText={setIng} />
      </div>
      <div className="section">
        <h3><label htmlFor="ed-steps">Kroki</label></h3>
        <p className="text-[.85rem] text-muted">Jeden krok w linii.</p>
        <textarea id="ed-steps" className={FIELD_CLS} rows={rowsFor(steps, 6)} value={steps} onChange={e => setSteps(e.currentTarget.value)} />
      </div>
      <div className="row mt-[18px]">
        <button className="btn primary" onClick={save}>Zapisz</button>
        <button className="btn ghost" onClick={done}>Anuluj</button>
      </div>
    </>
  );
}

export function RecipeSheet() {
  useSignals();
  const m = useModel();
  const r = useRecipe(openRecipe.value);
  const act = useAct();
  const [editing, setEditing] = useState<string | null>(null); // id of the recipe being edited
  if (!r || !m) return null;
  const ings = r.ing.map(i => ({ i, st: ingState(m, i.name) })).sort((a, b) => ORDER[a.st] - ORDER[b.st]);
  const setField = (f: Pick<Extract<Action, { action: "setRecipeField" }>, "field" | "value">) =>
    act({ action: "setRecipeField", recipeId: r.id, ...f } as Action);
  const close = () => { openRecipe.value = null; randomMode.value = false; setEditing(null); };

  if (editing === r.id) {
    return (
      <div className="wrap pt-3 pb-10">
        <div className="sticky top-0 z-[2] flex min-h-14 items-center justify-between gap-2 bg-bg py-2">
          <button className="btn ghost" onClick={() => setEditing(null)}>‹ Wróć</button>
        </div>
        <h2>{r.name}</h2>
        <RecipeEditor key={r.id} m={m} r={r} done={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div className="wrap pt-3 pb-10">
      <div className="sticky top-0 z-[2] flex min-h-14 items-center justify-between gap-2 bg-bg py-2">
        <button className="btn ghost" onClick={close}>‹ Wróć</button>
        <div className="row">
          {randomMode.value && <button className="btn primary" onClick={() => randomPick(m)}>Losuj jeszcze raz</button>}
          {isAdmin(m) && <button className="btn ghost" onClick={() => setEditing(r.id)}>Edytuj</button>}
        </div>
      </div>
      <h2>{r.name}</h2>
      {r.desc && <p className="mt-1.5 whitespace-pre-line text-muted">{r.desc}</p>}
      <div className="row mt-2.5">
        <MissBadge m={m} r={r} />
        {r.time > 0 && <span className="badge b-unk">{r.time} min</span>}
        {r.diff && <span className="badge b-unk">{r.diff}</span>}
        {r.ing.length > 0 && !r.ver && <span className="badge b-warn">składniki do sprawdzenia</span>}
      </div>
      {r.links.length > 0 && (
        <div className="row mt-2.5">
          {r.links.map((l, k) => (
            <a key={l} className="btn primary" href={/^https?:/i.test(l) ? l : "https://" + l} target="_blank" rel="noopener">
              {linkLabel(l)}{r.links.length > 1 ? " " + (k + 1) : ""} ↗
            </a>
          ))}
        </div>
      )}

      <div className="section">
        <h3>Składniki{r.ing.length ? ` · ${r.ing.length}` : ""}</h3>
        {r.ing.length
          ? ings.map(({ i, st }) => (
            <button key={i.name} className="flex w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2.5 text-left" disabled={st === "always"} aria-pressed={st !== "miss"}
              onClick={() => act({ action: "setPantry", name: i.name, have: st === "miss" })}>
              <span className={`grid size-6 flex-none place-items-center rounded-full text-[.85rem] font-extrabold ${MARK[st]}`}>{st === "miss" ? "✕" : "✓"}</span>
              <span className="min-w-0 flex-1">{i.name}
                {st === "always" && <span className="block text-[.75rem] text-muted">zawsze mam</span>}
                {!m.pantry.has(norm(i.name)) && <span className="block text-[.75rem] text-paprika">poza bazą{isAdmin(m) ? ", popraw w „Edytuj”" : ""}</span>}
              </span>
              {i.qty && <span className="max-w-[40%] flex-none text-right text-muted tabular-nums">{sumQty([i.qty])}</span>}
            </button>
          ))
          : <div className="empty">Brak listy składników. Dodaj je przyciskiem „Edytuj” na górze.</div>}
      </div>

      {r.steps.length > 0 && (
        <div className="section">
          <h3>Przepis</h3>
          <ol className="grid gap-2.5">
            {r.steps.map((s, k) => (
              <li key={k} className="flex gap-2.5">
                <span className="grid size-6 flex-none place-items-center rounded-full bg-line text-[.85rem] font-extrabold">{k + 1}</span>
                <span className="min-w-0 flex-1 pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <QueueIt m={m} r={r} />

      <div className="section">
        <h3>Po zrobieniu</h3>
        <label className="flex items-center gap-2.5 font-bold">
          <input type="checkbox" className="size-[22px] accent-basil" checked={r.done} onChange={e => setField({ field: "done", value: e.currentTarget.checked })} /> Było robione
        </label>
        <div className="flex gap-0.5" role="group" aria-label="Ocena">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} className={`p-1 text-[1.7rem] leading-none ${n <= r.rate ? "text-saffron" : "text-line"}`} aria-label={`${n} na 5`}
              onClick={() => setField({ field: "rate", value: n === r.rate ? "" : n })}>★</button>
          ))}
        </div>
        <textarea key={r.id} className="min-h-[84px] w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2.5"
          placeholder="Notatka na następny raz, np. mniej soli, podwójny sos" defaultValue={r.notes}
          onBlur={e => { const v = e.currentTarget.value; if (v !== r.notes) { setField({ field: "notes", value: v }); toast("Notatka zapisana"); } }} />
      </div>
      <p className="count">{r.type}{r.cats.length ? " · " + r.cats.join(", ") : ""}</p>
    </div>
  );
}
