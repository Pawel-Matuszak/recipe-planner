import { useEffect, useRef } from "preact/hooks";
import { useModel } from "../data/sheet";
import { filterRecipes, plural, type Filters } from "../model";
import { DEFAULT_FILTERS, filters, filtersOpen, resetFilters, setFilter } from "../state/ui";

const TIMES = [0, 15, 30, 60];
const timeLabel = (t: number) => (t ? `do ${t} min` : "Dowolny");

/** Filters that differ from the defaults, each with a label and a way to clear just that one. */
export function activeFilters(f: Filters): { key: keyof Filters; label: string }[] {
  const out: { key: keyof Filters; label: string }[] = [];
  if (f.type !== DEFAULT_FILTERS.type) out.push({ key: "type", label: f.type });
  if (f.maxTime) out.push({ key: "maxTime", label: timeLabel(f.maxTime) });
  if (f.cat) out.push({ key: "cat", label: f.cat });
  if (f.todo) out.push({ key: "todo", label: "Jeszcze nie robione" });
  if (f.arch) out.push({ key: "arch", label: "Z archiwum" });
  return out;
}
export const clearFilter = (k: keyof Filters) => setFilter(k, DEFAULT_FILTERS[k as keyof typeof DEFAULT_FILTERS] as never);

function Choice<T extends string | number>({ legend, name, options, value, label, onChange }: {
  legend: string; name: string; options: T[]; value: T; label: (v: T) => string; onChange: (v: T) => void;
}) {
  return (
    <fieldset class="grid gap-2">
      <legend class="mb-2 font-bold">{legend}</legend>
      <div class="flex flex-wrap gap-1.5">
        {options.map(o => (
          <label key={o} class="opt">
            <input type="radio" class="sr-only" name={name} checked={o === value} onChange={() => onChange(o)} />
            {label(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="check">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.currentTarget.checked)} />
      <span class="lbl">{label}{hint && <span class="sub">{hint}</span>}</span>
    </label>
  );
}

export function FiltersSheet() {
  const m = useModel();
  const ref = useRef<HTMLDialogElement>(null);
  const open = filtersOpen.value;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    document.body.classList.toggle("locked", open);
  }, [open]);

  const f = filters.value;
  const types = m ? ["Wszystkie", ...new Set(m.recipes.map(r => r.type))] : [];
  const cats = m ? ["", ...[...new Set(m.recipes.flatMap(r => r.cats))].sort((a, b) => a.localeCompare(b, "pl"))] : [];
  const count = m && open ? filterRecipes(m, f).length : 0;
  const close = () => (filtersOpen.value = false);

  return (
    <dialog ref={ref} class="sheet" aria-labelledby="filtersTitle" onClose={close}
      onClick={e => { if (e.target === e.currentTarget) close(); }}>
      {open && m && (
        <div class="flex max-h-[inherit] flex-col">
          <div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id="filtersTitle">Filtry</h2>
            <button class="btn ghost" disabled={!activeFilters(f).length && !f.can} onClick={resetFilters}>Wyczyść</button>
          </div>
          <div class="grid gap-5 overflow-y-auto overscroll-contain px-4 py-4">
            <Choice legend="Typ dania" name="type" options={types} value={f.type} label={t => t} onChange={v => setFilter("type", v)} />
            <Choice legend="Czas przygotowania" name="time" options={TIMES} value={f.maxTime} label={timeLabel} onChange={v => setFilter("maxTime", v)} />
            <Choice legend="Kategoria" name="cat" options={cats} value={f.cat} label={c => c || "Każda"} onChange={v => setFilter("cat", v)} />
            <fieldset class="grid gap-1.5">
              <legend class="mb-2 font-bold">Pokaż</legend>
              <Toggle label="Mogę zrobić teraz" hint="Najpierw dania, do których brakuje najmniej składników" checked={f.can} onChange={v => setFilter("can", v)} />
              <Toggle label="Jeszcze nie robione" checked={f.todo} onChange={v => setFilter("todo", v)} />
              <Toggle label="Z archiwum" hint="Także przepisy oznaczone jako archiwalne" checked={f.arch} onChange={v => setFilter("arch", v)} />
            </fieldset>
          </div>
          <div class="border-t border-line px-4 pt-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}>
            <button class="btn primary w-full" onClick={close}>Pokaż {count} {plural(count, "przepis", "przepisy", "przepisów")}</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
