import { useState } from "preact/hooks";
import { useAct, useModel, useRecipe } from "../data/sheet";
import { linkLabel } from "../lib/format";
import { randomPick } from "../lib/random";
import { DZIALY, ingState, norm, parseIng, similarIngredients, splitIng, suggestIngredient, sumQty, type IngState, type Model, type Recipe } from "../model";
import { toast } from "../state/toast";
import { openRecipe, randomMode } from "../state/ui";
import { MissBadge } from "./common";
import { useQueueAdd } from "./PlanView";

const ORDER: Record<IngState, number> = { miss: 0, have: 1, always: 2 };
const MARK: Record<IngState, string> = { miss: "bg-paprika-soft text-paprika", have: "bg-basil-soft text-basil", always: "bg-line text-muted" };

function QueueIt({ m, r }: { m: Model; r: Recipe }) {
  const add = useQueueAdd();
  const queued = m.plan.some(p => p.id === r.id && !p.cooked);
  return (
    <div class="section">
      <h3>Do ugotowania</h3>
      <button class="btn primary" disabled={queued} onClick={() => add(r.id, "")}>{queued ? "Już na liście do ugotowania" : "Dodaj do ugotowania"}</button>
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
    <div class="mt-2.5 grid gap-2">
      <p class="text-[.85rem] text-muted">Tych nazw nie ma w spiżarni. Zamień na istniejącą albo dodaj jako nowy składnik.</p>
      {names.map(n => {
        const isNew = fresh.includes(norm(n));
        const s = isNew ? null : suggestIngredient(n, m.pantry);
        const similar = isNew || s ? [] : similarIngredients(n, m.pantry);
        return (
          <div key={norm(n)} class="grid gap-2 rounded-[10px] border border-paprika-soft bg-surface px-3 py-2.5">
            <span class="font-bold text-paprika">{n}</span>
            {s
              ? <>
                <span>Czy chodziło o „{s}”?</span>
                <div class="row">
                  <button class="btn primary" onClick={() => swap(n, s)}>Zamień na „{s}”</button>
                  <button class="btn ghost" onClick={() => setFresh([...fresh, norm(n)])}>To nowy składnik</button>
                </div>
              </>
              : <>
                {similar.length > 0 && <>
                  <span>Podobne w bazie:</span>
                  <div class="row">
                    {similar.map(x => <button key={x} class="btn ghost" onClick={() => swap(n, x)}>Zamień na „{x}”</button>)}
                  </div>
                  <span class="text-[.85rem] text-muted">Albo dodaj jako nowy składnik:</span>
                </>}
                <div class="row">
                  <select class="field" aria-label={`Dział: ${n}`} value={dzial[norm(n)] ?? "Inne"} onChange={e => setDzial({ ...dzial, [norm(n)]: e.currentTarget.value })}>
                    {DZIALY.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <button class="btn primary" onClick={() => add(n)}>Dodaj do bazy</button>
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
  const act = useAct();
  const [desc, setDesc] = useState(r.desc);
  const [steps, setSteps] = useState(r.steps.join("\n"));
  const [ing, setIng] = useState(ingText(r));
  const [next, setNext] = useState(""); // "add ingredient" box with pantry names as suggestions
  const save = () => {
    const newIng = lines(ing).join("; ");
    act({
      action: "editRecipe", by: r.by, key: r.key, desc: desc.trim(), steps: lines(steps).join("\n"),
      // only resend ingredients when they changed, so fixing a step doesn't mark them as checked
      ...(newIng !== lines(ingText(r)).join("; ") && { ing: newIng }),
    });
    toast("Przepis zapisany");
    done();
  };

  return (
    <>
      <div class="section">
        <h3><label for="ed-desc">Opis</label></h3>
        <textarea id="ed-desc" class={FIELD_CLS} rows={rowsFor(desc, 3)} value={desc} onInput={e => setDesc(e.currentTarget.value)} />
      </div>
      <div class="section">
        <h3><label for="ed-ing">Składniki</label></h3>
        <p class="text-[.85rem] text-muted">Jeden w linii, ilość po dwukropku, np. „makaron: 200 g”.</p>
        <textarea id="ed-ing" class={FIELD_CLS} rows={rowsFor(ing, 5)} value={ing} onInput={e => setIng(e.currentTarget.value)} />
        <form class="row mt-2" onSubmit={e => { e.preventDefault(); if (next.trim()) { setIng([...lines(ing), next.trim()].join("\n")); setNext(""); } }}>
          <input class="field flex-1" list="pantry-names" aria-label="Nowy składnik" placeholder="np. masło: 50 g" autocomplete="off"
            value={next} onInput={e => setNext(e.currentTarget.value)} />
          <button class="btn ghost" type="submit">Dodaj</button>
        </form>
        <datalist id="pantry-names">{[...m.pantry.values()].map(p => <option key={p.name} value={p.name} />)}</datalist>
        <UnknownIngredients m={m} text={ing} setText={setIng} />
      </div>
      <div class="section">
        <h3><label for="ed-steps">Kroki</label></h3>
        <p class="text-[.85rem] text-muted">Jeden krok w linii.</p>
        <textarea id="ed-steps" class={FIELD_CLS} rows={rowsFor(steps, 6)} value={steps} onInput={e => setSteps(e.currentTarget.value)} />
      </div>
      <div class="row mt-[18px]">
        <button class="btn primary" onClick={save}>Zapisz</button>
        <button class="btn ghost" onClick={done}>Anuluj</button>
      </div>
    </>
  );
}

export function RecipeSheet() {
  const m = useModel();
  const r = useRecipe(openRecipe.value);
  const act = useAct();
  const [editing, setEditing] = useState<string | null>(null); // id of the recipe being edited
  if (!r || !m) return null;
  const ings = r.ing.map(i => ({ i, st: ingState(m, i.name) })).sort((a, b) => ORDER[a.st] - ORDER[b.st]);
  const setField = (field: "done" | "rate" | "notes", value: boolean | number | string) =>
    act({ action: "setRecipeField", by: r.by, key: r.key, field, value });
  const close = () => { openRecipe.value = null; randomMode.value = false; setEditing(null); };

  if (editing === r.id) {
    return (
      <div class="wrap pt-3 pb-10">
        <div class="sticky top-0 z-[2] flex min-h-14 items-center justify-between gap-2 bg-bg py-2">
          <button class="btn ghost" onClick={() => setEditing(null)}>‹ Wróć</button>
        </div>
        <h2>{r.name}</h2>
        <RecipeEditor key={r.id} m={m} r={r} done={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div class="wrap pt-3 pb-10">
      <div class="sticky top-0 z-[2] flex min-h-14 items-center justify-between gap-2 bg-bg py-2">
        <button class="btn ghost" onClick={close}>‹ Wróć</button>
        <div class="row">
          {randomMode.value && <button class="btn primary" onClick={() => randomPick(m)}>Losuj jeszcze raz</button>}
          <button class="btn ghost" onClick={() => setEditing(r.id)}>Edytuj</button>
        </div>
      </div>
      <h2>{r.name}</h2>
      {r.desc && <p class="mt-1.5 whitespace-pre-line text-muted">{r.desc}</p>}
      <div class="row mt-2.5">
        <MissBadge m={m} r={r} />
        {r.time > 0 && <span class="badge b-unk">{r.time} min</span>}
        {r.diff && <span class="badge b-unk">{r.diff}</span>}
        {r.ing.length > 0 && !r.ver && <span class="badge b-warn">składniki do sprawdzenia</span>}
      </div>
      {r.links.length > 0 && (
        <div class="row mt-2.5">
          {r.links.map((l, k) => (
            <a key={l} class="btn primary" href={/^https?:/i.test(l) ? l : "https://" + l} target="_blank" rel="noopener">
              {linkLabel(l)}{r.links.length > 1 ? " " + (k + 1) : ""} ↗
            </a>
          ))}
        </div>
      )}

      <div class="section">
        <h3>Składniki{r.ing.length ? ` · ${r.ing.length}` : ""}</h3>
        {r.ing.length
          ? ings.map(({ i, st }) => (
            <button key={i.name} class="flex w-full items-center gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2.5 text-left" disabled={st === "always"} aria-pressed={st !== "miss"}
              onClick={() => act({ action: "setPantry", name: i.name, have: st === "miss" })}>
              <span class={`grid size-6 flex-none place-items-center rounded-full text-[.85rem] font-extrabold ${MARK[st]}`}>{st === "miss" ? "✕" : "✓"}</span>
              <span class="min-w-0 flex-1">{i.name}
                {st === "always" && <span class="block text-[.75rem] text-muted">zawsze mam</span>}
                {!m.pantry.has(norm(i.name)) && <span class="block text-[.75rem] text-paprika">poza bazą, popraw w „Edytuj”</span>}
              </span>
              {i.qty && <span class="max-w-[40%] flex-none text-right text-muted tabular-nums">{sumQty([i.qty])}</span>}
            </button>
          ))
          : <div class="empty">Brak listy składników. Dodaj je przyciskiem „Edytuj” na górze.</div>}
      </div>

      {r.steps.length > 0 && (
        <div class="section">
          <h3>Przepis</h3>
          <ol class="grid gap-2.5">
            {r.steps.map((s, k) => (
              <li key={k} class="flex gap-2.5">
                <span class="grid size-6 flex-none place-items-center rounded-full bg-line text-[.85rem] font-extrabold">{k + 1}</span>
                <span class="min-w-0 flex-1 pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <QueueIt m={m} r={r} />

      <div class="section">
        <h3>Po zrobieniu</h3>
        <label class="flex items-center gap-2.5 font-bold">
          <input type="checkbox" class="size-[22px] accent-basil" checked={r.done} onChange={e => setField("done", e.currentTarget.checked)} /> Było robione
        </label>
        <div class="flex gap-0.5" role="group" aria-label="Ocena">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} class={`p-1 text-[1.7rem] leading-none ${n <= r.rate ? "text-saffron" : "text-line"}`} aria-label={`${n} na 5`}
              onClick={() => setField("rate", n === r.rate ? "" : n)}>★</button>
          ))}
        </div>
        <textarea key={r.id} class="min-h-[84px] w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2.5"
          placeholder="Notatka na następny raz, np. mniej soli, podwójny sos" defaultValue={r.notes}
          onChange={e => { const v = e.currentTarget.value; if (v !== r.notes) { setField("notes", v); toast("Notatka zapisana"); } }} />
      </div>
      <p class="count">{r.type}{r.cats.length ? " · " + r.cats.join(", ") : ""}</p>
    </div>
  );
}
