import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { norm } from "../model";

const MAX_SHOWN = 50; // the pantry can be long; typing narrows it anyway

type ComboboxProps = {
  value: string;
  options: readonly string[];
  /** An option was chosen (click, Enter), or the "new value" row. */
  onPick: (v: string) => void;
  /** Typed text; without it the field is a pick-one list and can't be typed into. */
  onInput?: (v: string) => void;
  /** Row offering the typed text as a new value, e.g. q => `Dodaj „${q}”`. */
  newLabel?: (q: string) => string;
  /** Shown text for an option, e.g. "" → "nie podano". */
  label?: (o: string) => string;
  id?: string;
  "aria-label"?: string;
  placeholder?: string;
  className?: string;
  /** Enter with no option highlighted (e.g. submit the "add" box). */
  onEnter?: () => void;
};

/** The one dropdown of the editor: a field with a filtered list under it, typed text optional. */
export function Combobox({ value, options, onPick, onInput, newLabel, label = o => o, onEnter, className = "", ...attrs }: ComboboxProps) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false); // filter only by what was typed since opening, not by the current value
  const [active, setActive] = useState(-1);
  const free = !!onInput;
  useEffect(() => { if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" }); }, [open, active, listId]);

  const q = typed ? norm(value) : "";
  const matches = q ? options.filter(o => norm(label(o)).includes(q)).sort((a, b) => +!norm(label(a)).startsWith(q) - +!norm(label(b)).startsWith(q)) : [...options];
  const rows = matches.slice(0, MAX_SHOWN).map(o => ({ value: o, text: label(o), isNew: false }));
  const t = value.trim();
  if (free && newLabel && t && !options.some(o => norm(o) === norm(t))) rows.push({ value: t, text: newLabel(t), isNew: true });

  const show = (on: boolean) => {
    setOpen(on);
    setTyped(false);
    setActive(on && !free ? options.indexOf(value) : -1);
  };
  const pick = (v: string) => { onPick(v); show(false); };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive(a => rows.length ? (a + step + rows.length) % rows.length : -1);
    } else if (e.key === "Enter") {
      if (open && rows[active]) { e.preventDefault(); pick(rows[active].value); }
      else if (onEnter) { e.preventDefault(); onEnter(); show(false); }
      else if (!free) { e.preventDefault(); show(!open); }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      show(false);
    }
  };

  return (
    <div className={`combo ${className}`}>
      <input ref={input} {...attrs} className="field" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete={free ? "list" : "none"}
        aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
        value={free ? value : label(value)} readOnly={!free} autoComplete="off"
        onClick={() => { if (!free) show(!open); else if (!open) show(true); }} onKeyDown={onKeyDown}
        onChange={e => { onInput?.(e.currentTarget.value); setOpen(true); setTyped(true); setActive(-1); }}
        onBlur={() => show(false)} />
      <button type="button" tabIndex={-1} className="combo-toggle" aria-label="Pokaż listę" onMouseDown={e => e.preventDefault()}
        onClick={() => { show(!open); input.current?.focus(); }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && rows.length > 0 && (
        <ul id={listId} role="listbox" className="combo-list">
          {rows.map((r, k) => (
            <li key={(r.isNew ? "+" : "") + r.value} id={`${listId}-${k}`} role="option" aria-selected={k === active}
              className={`${r.isNew ? "new" : ""} ${!r.isNew && r.value === value ? "current" : ""}`}
              onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(k)} onClick={() => pick(r.value)}>
              {r.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Several values from a list, as removable chips, plus new ones typed in (Enter or comma adds). */
export function MultiCombobox({ values, options, onChange, id, newLabel, placeholder }: {
  values: string[]; options: readonly string[]; onChange: (v: string[]) => void; id?: string; newLabel: (q: string) => string; placeholder?: string;
}) {
  const [text, setText] = useState("");
  const addAll = (vs: string[], rest = "") => {
    const next = [...values];
    for (const v of vs.map(s => s.trim()).filter(Boolean)) {
      // a typed "makaron" reuses the existing "Makaron"
      if (!next.some(x => norm(x) === norm(v))) next.push(options.find(o => norm(o) === norm(v)) ?? v);
    }
    if (next.length !== values.length) onChange(next);
    setText(rest);
  };
  const add = (v: string) => addAll([v]);
  const typed = (s: string) => {
    if (!s.includes(",")) return setText(s);
    const parts = s.split(",");
    const rest = parts.pop()!;
    addAll(parts, rest.trimStart());
  };
  return (
    <div className="grid gap-2">
      {values.length > 0 && (
        <div className="row">
          {values.map(v => (
            <span key={v} className="chip inline-flex items-center gap-1 pr-1.5">
              {v}
              <button type="button" className="grid size-6 place-items-center rounded-full text-muted" aria-label={`Usuń: ${v}`}
                onClick={() => onChange(values.filter(x => x !== v))}>✕</button>
            </span>
          ))}
        </div>
      )}
      <Combobox id={id} value={text} placeholder={placeholder} newLabel={newLabel}
        options={options.filter(o => !values.some(x => norm(x) === norm(o)))}
        onInput={typed}
        onPick={add} onEnter={() => add(text)} />
    </div>
  );
}
