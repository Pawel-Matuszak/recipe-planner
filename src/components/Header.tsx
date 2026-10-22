import { useSignals } from "@preact/signals-react/runtime";
import { useQueryClient } from "@tanstack/react-query";
import { refresh, useModel, useSyncStatus, type SyncStatus } from "../data/sheet";
import { randomPick } from "../lib/random";
import { filters, filtersOpen, onlyHave, pantryQuery, setFilter, settingsOpen, tab } from "../state/ui";
import { activeFilters, clearFilter } from "./FiltersSheet";
import { Icon } from "./Icon";

const TITLES = { przepisy: "Obiadki", plan: "Do ugotowania", zakupy: "Lista zakupów", spizarnia: "Spiżarnia" };
const DOT = { ok: "bg-basil", busy: "bg-saffron", err: "bg-paprika", none: "bg-muted" };

function Status({ s }: { s: SyncStatus }) {
  let dot: keyof typeof DOT = "none", txt = "Łączę…";
  if (s.kind === "busy") { dot = "busy"; txt = "Synchronizuję…"; }
  else if (s.kind === "error") { dot = "err"; txt = s.hasData ? "Offline: dane z telefonu" : "Brak połączenia"; }
  else if (s.kind === "ok") { dot = "ok"; txt = s.demo ? "Tryb demo" : "Połączono z arkuszem"; }
  if (s.pending) { dot = "busy"; txt += ` · ${s.pending} ${s.pending === 1 ? "zmiana czeka" : "zmian czeka"}`; }
  return <span className="flex items-center gap-1.5 text-[.78rem] text-muted"><span className={`size-2 flex-none rounded-full ${DOT[dot]}`} />{txt}</span>;
}

function RecipeFilters() {
  useSignals();
  const m = useModel();
  if (!m) return null;
  const f = filters.value;
  const active = activeFilters(f);
  const n = active.length + (f.can ? 1 : 0);
  return (
    <>
      <div className="flex gap-2">
        <input className="search-input" type="search" placeholder="Danie lub składnik…" aria-label="Szukaj dania lub składnika" value={f.q} autoComplete="off" enterKeyHint="search"
          onChange={e => setFilter("q", e.currentTarget.value)} />
        <button className={`iconbtn gap-1.5 ${n ? "border-ink" : ""}`} onClick={() => (filtersOpen.value = true)} aria-haspopup="dialog"
          aria-label={n ? `Filtry, aktywne: ${n}` : "Filtry"}>
          <span className="flex items-center gap-1.5"><Icon name="filters" />{n > 0 && <span className="count-dot">{n}</span>}</span>
        </button>
        <button className="iconbtn primary" onClick={() => randomPick(m)}>Losuj</button>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Aktywne filtry">
        <button className="chip can" aria-pressed={f.can} onClick={() => setFilter("can", !f.can)}>Mogę zrobić teraz</button>
        {active.map(a => (
          <button key={a.key} className="chip" aria-pressed="true" aria-label={`Usuń filtr: ${a.label}`} onClick={() => clearFilter(a.key)}>
            {a.label}<span aria-hidden="true" className="ml-1.5 opacity-70">×</span>
          </button>
        ))}
      </div>
    </>
  );
}

function PantryFilters() {
  useSignals();
  return (
    <>
      <div className="flex gap-2">
        <input className="search-input" type="search" placeholder="Szukaj składnika…" value={pantryQuery.value} autoComplete="off"
          onChange={e => (pantryQuery.value = e.currentTarget.value)} />
      </div>
      <div className="chips">
        <button className="chip" aria-pressed={onlyHave.value} onClick={() => (onlyHave.value = !onlyHave.value)}>Tylko to, co mam</button>
      </div>
    </>
  );
}

export function Header() {
  useSignals();
  const qc = useQueryClient();
  const s = useSyncStatus();
  const m = useModel();
  return (
    <header className="sticky z-20 grid gap-2.5 bg-bg pt-3 pb-2.5" style={{ top: "env(safe-area-inset-top, 0px)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><h1>{TITLES[tab.value]}</h1><Status s={s} /></div>
        <div className="row">
          <button className="iconbtn" onClick={() => void refresh(qc, true)} aria-label="Odśwież z arkusza"><Icon name="refresh" /></button>
          <button className="iconbtn" onClick={() => (settingsOpen.value = true)} aria-label="Ustawienia"><Icon name="settings" /></button>
        </div>
      </div>
      {tab.value === "przepisy" && m && <RecipeFilters />}
      {tab.value === "spizarnia" && m && <PantryFilters />}
      {s.message && (
        <div className={`grid gap-2 rounded-card px-3.5 py-3 text-[.92rem] ${s.hasData ? "bg-saffron-soft" : "bg-paprika-soft"}`}>
          <span>{s.message}</span>
          <div className="row">
            <button className="rounded-full bg-ink px-3.5 py-2 font-bold text-bg" onClick={() => void refresh(qc, true)}>Spróbuj ponownie</button>
            <button className="px-3.5 py-2 font-bold underline" onClick={() => (settingsOpen.value = true)}>Ustawienia</button>
          </div>
        </div>
      )}
    </header>
  );
}
