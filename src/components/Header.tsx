import { useQueryClient } from "@tanstack/preact-query";
import { refresh, useModel, useSyncStatus, type SyncStatus } from "../data/sheet";
import { randomPick } from "../lib/random";
import { filters, onlyHave, pantryQuery, setFilter, settingsOpen, tab } from "../state/ui";
import { Icon } from "./Icon";

const TITLES = { przepisy: "Obiadki", plan: "Do ugotowania", zakupy: "Lista zakupów", spizarnia: "Spiżarnia" };
const DOT = { ok: "bg-basil", busy: "bg-saffron", err: "bg-paprika", none: "bg-muted" };

function Status({ s }: { s: SyncStatus }) {
  let dot: keyof typeof DOT = "none", txt = "Łączę…";
  if (s.kind === "busy") { dot = "busy"; txt = "Synchronizuję…"; }
  else if (s.kind === "error") { dot = "err"; txt = s.hasData ? "Offline: dane z telefonu" : "Brak połączenia"; }
  else if (s.kind === "ok") { dot = "ok"; txt = s.demo ? "Tryb demo" : "Połączono z arkuszem"; }
  if (s.pending) { dot = "busy"; txt += ` · ${s.pending} ${s.pending === 1 ? "zmiana czeka" : "zmian czeka"}`; }
  return <span class="flex items-center gap-1.5 text-[.78rem] text-muted"><span class={`size-2 flex-none rounded-full ${DOT[dot]}`} />{txt}</span>;
}

function RecipeFilters() {
  const m = useModel();
  if (!m) return null;
  const f = filters.value;
  const types = ["Wszystkie", ...new Set(m.recipes.map(r => r.type))];
  const cats = [...new Set(m.recipes.flatMap(r => r.cats))].sort((a, b) => a.localeCompare(b, "pl"));
  return (
    <>
      <div class="flex gap-2">
        <input class="search-input" type="search" placeholder="Szukaj dania lub składnika…" value={f.q} autocomplete="off" enterkeyhint="search"
          onInput={e => setFilter("q", e.currentTarget.value)} />
        <button class="iconbtn primary" onClick={() => randomPick(m)}>Losuj</button>
      </div>
      <div class="chips" role="group" aria-label="Filtry">
        <button class="chip can" aria-pressed={f.can} onClick={() => setFilter("can", !f.can)}>Mogę zrobić teraz</button>
        {[15, 30, 60].map(t => (
          <button key={t} class="chip" aria-pressed={f.maxTime === t} onClick={() => setFilter("maxTime", f.maxTime === t ? 0 : t)}>≤ {t} min</button>
        ))}
        <button class="chip" aria-pressed={f.todo} onClick={() => setFilter("todo", !f.todo)}>Jeszcze nie robione</button>
        <select class="chip" aria-label="Kategoria" value={f.cat} onChange={e => setFilter("cat", e.currentTarget.value)}>
          <option value="">Każda kategoria</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button class="chip" aria-pressed={f.arch} onClick={() => setFilter("arch", !f.arch)}>Archiwum</button>
      </div>
      <div class="chips" role="group" aria-label="Typ">
        {types.map(t => <button key={t} class="chip" aria-pressed={f.type === t} onClick={() => setFilter("type", t)}>{t}</button>)}
      </div>
    </>
  );
}

function PantryFilters() {
  return (
    <>
      <div class="flex gap-2">
        <input class="search-input" type="search" placeholder="Szukaj składnika…" value={pantryQuery.value} autocomplete="off"
          onInput={e => (pantryQuery.value = e.currentTarget.value)} />
      </div>
      <div class="chips">
        <button class="chip" aria-pressed={onlyHave.value} onClick={() => (onlyHave.value = !onlyHave.value)}>Tylko to, co mam</button>
      </div>
    </>
  );
}

export function Header() {
  const qc = useQueryClient();
  const s = useSyncStatus();
  const m = useModel();
  return (
    <header class="sticky z-20 grid gap-2.5 bg-bg pt-3 pb-2.5" style={{ top: "env(safe-area-inset-top, 0px)" }}>
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0"><h1>{TITLES[tab.value]}</h1><Status s={s} /></div>
        <div class="row">
          <button class="iconbtn" onClick={() => void refresh(qc, true)} aria-label="Odśwież z arkusza"><Icon name="refresh" /></button>
          <button class="iconbtn" onClick={() => (settingsOpen.value = true)} aria-label="Ustawienia"><Icon name="settings" /></button>
        </div>
      </div>
      {tab.value === "przepisy" && m && <RecipeFilters />}
      {tab.value === "spizarnia" && m && <PantryFilters />}
      {s.message && (
        <div class={`grid gap-2 rounded-card px-3.5 py-3 text-[.92rem] ${s.hasData ? "bg-saffron-soft" : "bg-paprika-soft"}`}>
          <span>{s.message}</span>
          <div class="row">
            <button class="rounded-full bg-ink px-3.5 py-2 font-bold text-bg" onClick={() => void refresh(qc, true)}>Spróbuj ponownie</button>
            <button class="px-3.5 py-2 font-bold underline" onClick={() => (settingsOpen.value = true)}>Ustawienia</button>
          </div>
        </div>
      )}
    </header>
  );
}
