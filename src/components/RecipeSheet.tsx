import { useSignals } from "@preact/signals-react/runtime";
import { useState } from "react";
import { DIFFICULTIES, type Action } from "../actions";
import { useAct, useModel, useRecipe } from "../data/sheet";
import { linkLabel } from "../lib/format";
import { randomPick } from "../lib/random";
import { ingLines, ingState, isAdmin, newId, norm, parseIngList, plural, similarIngredients, stepLines, suggestIngredient, sumQty, type IngState, type Model, type Recipe } from "../model";
import { toast } from "../state/toast";
import { newRecipe, openRecipe, randomMode } from "../state/ui";
import { Combobox, MultiCombobox } from "./Combobox";
import { MissBadge } from "./common";
import { useQueueAdd } from "./PlanView";

const ORDER: Record<IngState, number> = { miss: 0, have: 1, always: 2 };
const MARK: Record<IngState, string> = { miss: "bg-paprika-soft text-paprika", have: "bg-basil-soft text-basil", always: "bg-line text-muted" };
const SEC_CLS = "mt-2 text-[.8rem] font-bold uppercase text-muted";

/** Consecutive items of the same section ("# Sos" in the editor), in order. */
function bySection<T extends { sec?: string }>(xs: T[]): { sec?: string; items: T[] }[] {
  const groups: { sec?: string; items: T[] }[] = [];
  for (const x of xs) {
    if (!groups.length || groups.at(-1)!.sec !== x.sec) groups.push({ sec: x.sec, items: [] });
    groups.at(-1)!.items.push(x);
  }
  return groups;
}

const portionsLabel = (n: number) => `${n} ${plural(n, "porcja", "porcje", "porcji")}`;

/** "− 4 porcje +": how many portions to show the amounts for; nothing is saved. */
function Portions({ n, base, set }: { n: number; base: number; set: (n: number) => void }) {
  const STEP_CLS = "btn size-9 p-0 text-lg";
  return (
    <div className="row ml-auto gap-1.5" role="group" aria-label="Porcje">
      {n !== base && <button className="text-[.85rem] text-muted underline" onClick={() => set(base)}>przywróć</button>}
      <button className={STEP_CLS} aria-label="Mniej porcji" disabled={n <= 1} onClick={() => set(n - 1)}>−</button>
      <span className="min-w-[5.5rem] text-center font-bold tabular-nums" aria-live="polite">{portionsLabel(n)}</span>
      <button className={STEP_CLS} aria-label="Więcej porcji" disabled={n >= 100} onClick={() => set(n + 1)}>+</button>
    </div>
  );
}

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
const ingText = (r: Recipe) => ingLines(r.ing).join("\n");

/** Names in the ingredient field that aren't in the pantry: swap one for a close pantry name or add it as a new product. */
function UnknownIngredients({ m, text, setText }: { m: Model; text: string; setText: (s: string) => void }) {
  useSignals();
  const act = useAct();
  const [fresh, setFresh] = useState<string[]>([]); // marked "To nowy składnik", so no more suggestion
  const [dzial, setDzial] = useState<Record<string, string>>({});
  const all = parseIngList(lines(text).join("; ")).map(i => i.name);
  const names = [...new Map(all.map(n => [norm(n), n])).values()].filter(n => !m.pantry.has(norm(n)));
  if (!names.length) return null;

  // keeps the amount, the note and the separators around the name as they were
  const swap = (from: string, to: string) => setText(text.split("\n").map(l => l.split(";").map(part => {
    const name = parseIngList(part)[0]?.name;
    if (name === undefined || norm(name) !== norm(from)) return part;
    return part.match(/^\s*/)![0] + to + part.trimStart().slice(name.length);
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
                  <Combobox aria-label={`Dział: ${n}`} options={m.dzialy} value={dzial[norm(n)] ?? "Inne"} onPick={v => setDzial({ ...dzial, [norm(n)]: v })} />
                  <button className="btn primary" onClick={() => add(n)}>Dodaj do bazy</button>
                </div>
              </>}
          </div>
        );
      })}
    </div>
  );
}

const BLANK: Recipe = { id: "", name: "", type: "Danie główne", diff: "", done: false, arch: false, links: [], cats: [], time: 0, ing: [], ver: false, rate: 0, notes: "", desc: "", steps: [], serv: 0 };
const DIFF_OPTIONS = ["", ...DIFFICULTIES];
type Difficulty = Extract<Action, { action: "createRecipe" }>["diff"];

/** Admin form for a recipe: everything but the household's own done / rating / notes. Without `r` it creates a new one. */
export function RecipeEditor({ m, r, done }: { m: Model; r?: Recipe; done: (id?: string) => void }) {
  useSignals();
  const act = useAct();
  const base = r ?? BLANK;
  const [name, setName] = useState(base.name);
  const [type, setType] = useState(base.type);
  const [diff, setDiff] = useState(base.diff);
  const [time, setTime] = useState(base.time ? String(base.time) : "");
  const [serv, setServ] = useState(base.serv ? String(base.serv) : "");
  const [cats, setCats] = useState(base.cats);
  const [links, setLinks] = useState(base.links.join("\n"));
  const [arch, setArch] = useState(base.arch);
  const [desc, setDesc] = useState(base.desc);
  const [steps, setSteps] = useState(stepLines(base.steps).join("\n"));
  const [ing, setIng] = useState(ingText(base));
  const [next, setNext] = useState(""); // "add ingredient" box with pantry names as suggestions
  const types = [...new Set([...m.recipes.map(x => x.type), "Danie główne"])].sort((a, b) => a.localeCompare(b, "pl"));
  const allCats = [...new Set(m.recipes.flatMap(x => x.cats))].sort((a, b) => a.localeCompare(b, "pl"));
  const pantryNames = [...m.pantry.values()].map(p => p.name).sort((a, b) => a.localeCompare(b, "pl"));
  const addNext = () => { if (next.trim()) { setIng([...lines(ing), next.trim()].join("\n")); setNext(""); } };

  const save = () => {
    if (!name.trim()) return toast("Podaj nazwę przepisu");
    if (!type.trim()) return toast("Podaj typ, np. Danie główne");
    const newIng = lines(ing).join("; ");
    const data = {
      name: name.trim(), type: type.trim(), diff: diff as Difficulty, time: Math.max(0, parseInt(time, 10) || 0),
      serv: Math.min(100, Math.max(0, parseInt(serv, 10) || 0)), cats, links: lines(links), arch, desc: desc.trim(), steps: lines(steps).join("\n"),
    };
    if (!r) {
      const id = newId();
      act({ action: "createRecipe", recipeId: id, ...data, ing: newIng });
      toast("Przepis dodany");
      return done(id);
    }
    // only resend ingredients when they changed, so fixing a step doesn't mark them as checked
    act({ action: "editRecipe", recipeId: r.id, ...data, ...(newIng !== lines(ingText(r)).join("; ") && { ing: newIng }) });
    toast("Przepis zapisany");
    done(r.id);
  };

  return (
    <>
      <div className="section">
        <h3><label htmlFor="ed-name">Nazwa</label></h3>
        <input id="ed-name" className="field" value={name} onChange={e => setName(e.currentTarget.value)} autoComplete="off" />
      </div>
      <div className="section">
        <div className="row items-end">
          <label className="grid min-w-[140px] flex-1 gap-1 font-bold">Typ
            <Combobox value={type} options={types} onInput={setType} onPick={setType} newLabel={q => `Nowy typ: „${q}”`} />
          </label>
          <label className="grid min-w-[120px] flex-1 gap-1 font-bold">Trudność
            <Combobox value={diff} options={DIFF_OPTIONS} onPick={setDiff} label={d => d || "nie podano"} />
          </label>
          <label className="grid w-28 gap-1 font-bold">Czas (min)
            <input className="field" type="number" inputMode="numeric" min={0} value={time} onChange={e => setTime(e.currentTarget.value)} />
          </label>
          <label className="grid w-24 gap-1 font-bold">Porcje
            <input className="field" type="number" inputMode="numeric" min={0} max={100} value={serv} onChange={e => setServ(e.currentTarget.value)} />
          </label>
        </div>
      </div>
      <div className="section">
        <h3><label htmlFor="ed-cats">Kategorie</label></h3>
        <MultiCombobox id="ed-cats" values={cats} options={allCats} onChange={setCats} placeholder="Wybierz albo wpisz nową"
          newLabel={q => `Dodaj kategorię „${q}”`} />
      </div>
      <div className="section">
        <h3><label htmlFor="ed-links">Linki</label></h3>
        <p className="text-[.85rem] text-muted">Jeden w linii.</p>
        <textarea id="ed-links" className={FIELD_CLS} rows={rowsFor(links, 2)} value={links} onChange={e => setLinks(e.currentTarget.value)} />
      </div>
      <div className="section">
        <h3><label htmlFor="ed-desc">Opis</label></h3>
        <textarea id="ed-desc" className={FIELD_CLS} rows={rowsFor(desc, 3)} value={desc} onChange={e => setDesc(e.currentTarget.value)} />
      </div>
      <div className="section">
        <h3><label htmlFor="ed-ing">Składniki</label></h3>
        <p className="text-[.85rem] text-muted">Jeden w linii, ilość po dwukropku, np. „makaron: 200 g”. Linia „# Sos” zaczyna sekcję, a uwagę dopisz w nawiasie na końcu, np. „przyprawa: 1 opak. (lub domowa mieszanka)”.</p>
        <textarea id="ed-ing" className={FIELD_CLS} rows={rowsFor(ing, 5)} value={ing} onChange={e => setIng(e.currentTarget.value)} />
        <form className="row mt-2" onSubmit={e => { e.preventDefault(); addNext(); }}>
          {/* picking a pantry name leaves room for the amount */}
          <Combobox aria-label="Nowy składnik" placeholder="np. masło: 50 g" value={next} options={pantryNames}
            onInput={setNext} onPick={n => setNext(n + ": ")} onEnter={addNext} />
          <button className="btn ghost" type="submit">Dodaj</button>
        </form>
        <UnknownIngredients m={m} text={ing} setText={setIng} />
      </div>
      <div className="section">
        <h3><label htmlFor="ed-steps">Kroki</label></h3>
        <p className="text-[.85rem] text-muted">Jeden krok w linii, bez numerów. Linia „# Sos” zaczyna sekcję, numeracja liczy się w niej od 1.</p>
        <textarea id="ed-steps" className={FIELD_CLS} rows={rowsFor(steps, 6)} value={steps} onChange={e => setSteps(e.currentTarget.value)} />
      </div>
      <label className="mt-[18px] flex items-center gap-2.5 font-bold">
        <input type="checkbox" className="size-[22px] flex-none accent-basil" checked={arch} onChange={e => setArch(e.currentTarget.checked)} />
        <span>W archiwum <span className="block text-[.8rem] font-normal text-muted">ukryty na liście, chyba że w filtrach włączysz archiwum</span></span>
      </label>
      <div className="row mt-[18px]">
        <button className="btn primary" onClick={save}>{r ? "Zapisz" : "Dodaj przepis"}</button>
        <button className="btn ghost" onClick={() => done(r?.id)}>Anuluj</button>
      </div>
    </>
  );
}

/** Admin: the empty recipe form; saving opens the new recipe. */
export function NewRecipeSheet() {
  useSignals();
  const m = useModel();
  if (!m) return null;
  const done = (id?: string) => { newRecipe.value = false; if (id) openRecipe.value = id; };
  return (
    <div className="wrap pt-3 pb-10">
      <div className="sticky top-0 z-[2] flex min-h-14 items-center bg-bg py-2">
        <button className="btn ghost" onClick={() => done()}>‹ Wróć</button>
      </div>
      <h2>Nowy przepis</h2>
      <RecipeEditor m={m} done={done} />
    </div>
  );
}

export function RecipeSheet() {
  useSignals();
  const m = useModel();
  const r = useRecipe(openRecipe.value);
  const act = useAct();
  const [editing, setEditing] = useState<string | null>(null); // id of the recipe being edited
  const [portions, setPortions] = useState<{ key: string; n: number } | null>(null); // only for the recipe (and base) it was picked on
  if (!r || !m) return null;
  const portionsKey = `${r.id}/${r.serv}`;
  const shownPortions = portions?.key === portionsKey ? portions.n : r.serv;
  const factor = r.serv > 0 ? shownPortions / r.serv : 1;
  // ingredients by section in recipe order; within each, what's missing first
  const groups = bySection(r.ing.map((i, k) => ({ i, k, st: ingState(m, i.name), sec: i.sec })));
  for (const g of groups) g.items.sort((a, b) => ORDER[a.st] - ORDER[b.st]);
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
        {r.serv > 0 && <span className="badge b-unk">{portionsLabel(r.serv)}</span>}
        {r.diff && <span className="badge b-unk">{r.diff}</span>}
        {r.ing.length > 0 && !r.ver && <span className="badge b-warn">składniki do sprawdzenia</span>}
        {r.arch && <span className="badge b-unk">w archiwum</span>}
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
        <div className="row">
          <h3>Składniki{r.ing.length ? ` · ${r.ing.length}` : ""}</h3>
          {r.serv > 0 && r.ing.length > 0 && <Portions n={shownPortions} base={r.serv} set={n => setPortions({ key: portionsKey, n })} />}
        </div>
        {r.ing.length
          ? groups.map(g => (
            <div key={g.items[0].k} className="grid gap-2">
              {g.sec && <h4 className={SEC_CLS}>{g.sec}</h4>}
              {g.items.map(({ i, k, st }) => (
                <button key={k} className="flex w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2.5 text-left" disabled={st === "always"} aria-pressed={st !== "miss"}
                  onClick={() => act({ action: "setPantry", name: i.name, have: st === "miss" })}>
                  <span className={`grid size-6 flex-none place-items-center rounded-full text-[.85rem] font-extrabold ${MARK[st]}`}>{st === "miss" ? "✕" : "✓"}</span>
                  <span className="min-w-0 flex-1">{i.name}
                    {i.note && <span className="block text-[.8rem] text-muted">{i.note}</span>}
                    {st === "always" && <span className="block text-[.75rem] text-muted">zawsze mam</span>}
                    {!m.pantry.has(norm(i.name)) && <span className="block text-[.75rem] text-paprika">poza bazą{isAdmin(m) ? ", popraw w „Edytuj”" : ""}</span>}
                  </span>
                  {i.qty && <span className="max-w-[40%] flex-none text-right text-muted tabular-nums">{sumQty([i.qty], factor)}</span>}
                </button>
              ))}
            </div>
          ))
          :<div className="empty">Brak listy składników. Dodaj je przyciskiem „Edytuj” na górze.</div>}
      </div>

      {r.steps.length > 0 && (
        <div className="section">
          <h3>Przepis</h3>
          {bySection(r.steps).map((g, gk) => (
            <div key={gk} className="grid gap-2.5">
              {g.sec && <h4 className={SEC_CLS}>{g.sec}</h4>}
              <ol className="grid gap-2.5">
                {g.items.map((s, k) => (
                  <li key={k} className="flex gap-2.5">
                    <span className="grid size-6 flex-none place-items-center rounded-full bg-line text-[.85rem] font-extrabold">{k + 1}</span>
                    <span className="min-w-0 flex-1 pt-0.5">{s.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
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
