import { useSignals } from "@preact/signals-react/runtime";
import { useState } from "react";
import { useAct, useModel } from "../data/sheet";
import { iso, newId, norm, type Model, type PlanEntry } from "../model";
import { toast } from "../state/toast";
import { openRecipe, randomMode } from "../state/ui";
import { Empty, MissBadge } from "./common";

const DONE_SHOWN = 5;

export function useQueueAdd() {
  const act = useAct();
  return (id: string, text: string) => {
    act({ action: "addPlan", uid: newId(), date: iso(new Date()), meal: "", id, text });
    toast("Dodano do ugotowania");
  };
}

function AddToQueue({ m }: { m: Model }) {
  useSignals();
  const [q, setQ] = useState("");
  const add = useQueueAdd();
  const nq = norm(q);
  const opts = nq ? m.recipes.filter(r => !r.arch && norm(r.name).includes(nq)).slice(0, 8) : [];
  const done = (id: string, text: string) => { add(id, text); setQ(""); };
  return (
    <form className="grid gap-2" onSubmit={e => { e.preventDefault(); if (nq) done(opts.length === 1 ? opts[0].id : "", opts.length === 1 ? "" : q.trim()); }}>
      <input className="search-input" placeholder="Dodaj danie: wpisz nazwę…" value={q} autoComplete="off" enterKeyHint="done" onChange={e => setQ(e.currentTarget.value)} />
      {nq && (
        <div className="list">
          {opts.map(r => (
            <button type="button" key={r.id} className="card" onClick={() => done(r.id, "")}><span className="font-bold">{r.name}</span><MissBadge m={m} r={r} /></button>
          ))}
          <button type="button" className="btn" onClick={() => done("", q.trim())}>Dodaj jako tekst: „{q.trim()}”</button>
        </div>
      )}
    </form>
  );
}

function QueueRow({ m, p }: { m: Model; p: PlanEntry }) {
  useSignals();
  const act = useAct();
  const r = p.id ? m.recipes.find(x => x.id === p.id) : undefined;
  const setCooked = (cooked: boolean) => {
    act({ action: "setCooked", uid: p.uid, cooked });
    if (cooked && r && !r.done) act({ action: "setRecipeField", recipeId: r.id, field: "done", value: true });
    if (cooked) toast(`${r?.name ?? p.text}: ugotowane`);
  };
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-card border border-line bg-surface px-3 py-2">
      <input type="checkbox" className="size-[22px] accent-basil" aria-label="Ugotowane" checked={p.cooked} onChange={e => setCooked(e.currentTarget.checked)} />
      <div className="grid min-w-0 gap-1">
        {r
          ? <button className={`min-w-0 text-left font-bold wrap-anywhere ${p.cooked ? "text-muted line-through" : "text-basil underline underline-offset-3"}`}
              onClick={() => { randomMode.value = false; openRecipe.value = r.id; }}>{r.name}</button>
          : <span className={`min-w-0 wrap-anywhere ${p.cooked ? "text-muted line-through" : ""}`}>{p.text || p.id}</span>}
        {r && !p.cooked && <div><MissBadge m={m} r={r} /></div>}
      </div>
      <button className="size-9 rounded-full text-[1.2rem] text-muted" aria-label="Usuń z listy"
        onClick={() => act({ action: "removePlan", uid: p.uid })}>×</button>
    </div>
  );
}

export function PlanView() {
  useSignals();
  const m = useModel();
  if (!m) return <Empty>Wczytuję…</Empty>;
  const todo = m.plan.filter(p => !p.cooked);
  const cooked = m.plan.filter(p => p.cooked).slice(-DONE_SHOWN).reverse();
  return (
    <>
      <AddToQueue m={m} />
      <div className="section">
        <h3>Do ugotowania</h3>
        {todo.length
          ? <div className="list">{todo.map(p => <QueueRow key={p.uid} m={m} p={p} />)}</div>
          : <Empty>Pusto. Dodaj danie powyżej albo z karty przepisu.</Empty>}
      </div>
      {cooked.length > 0 && (
        <div className="section">
          <h3>Ostatnio ugotowane</h3>
          <div className="list">{cooked.map(p => <QueueRow key={p.uid} m={m} p={p} />)}</div>
        </div>
      )}
    </>
  );
}
