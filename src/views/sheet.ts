import { DAYS, ingState, iso, MEALS, missingOf, weekDates, type IngState } from "../model";
import { byId, S } from "../state";
import { esc, linkLabel } from "../ui";
import { missBadge } from "./recipes";

const ORDER: Record<IngState, number> = { miss: 0, have: 1, always: 2 };

export function renderRecipeSheet(): string {
  const r = S.open ? byId(S.open) : undefined;
  if (!r || !S.model) return "";
  const m = S.model;
  const miss = missingOf(m, r);
  const ings = r.ing.map(i => ({ i, st: ingState(m, i) })).sort((a, b) => ORDER[a.st] - ORDER[b.st]);
  const dates = [...weekDates(0), ...weekDates(1)];
  const defMeal = r.type === "Śniadanie" ? "Śniadanie" : "Obiad";
  const hint = { miss: "dotknij: mam", have: "dotknij: brak", always: "zawsze" };

  return `<div class="wrap">
    <div class="sheet-head"><button class="btn ghost" data-act="close">‹ Wróć</button>${S.randomMode ? `<button class="btn primary" data-act="random">Losuj jeszcze raz</button>` : ""}</div>
    <h2>${esc(r.name)}</h2>
    <div class="row badges">${missBadge(r)}${r.time ? `<span class="badge b-unk">${r.time} min</span>` : ""}${r.diff ? `<span class="badge b-unk">${esc(r.diff)}</span>` : ""}${r.ing.length && !r.ver ? `<span class="badge b-warn">składniki do sprawdzenia</span>` : ""}</div>
    ${r.links.length ? `<div class="row links">${r.links.map((l, k) => `<a class="btn primary" href="${esc(/^https?:/i.test(l) ? l : "https://" + l)}" target="_blank" rel="noopener">${esc(linkLabel(l))}${r.links.length > 1 ? " " + (k + 1) : ""} ↗</a>`).join("")}</div>` : ""}

    <div class="section"><h3>Składniki${r.ing.length ? ` · ${r.ing.length}` : ""}</h3>
      ${r.ing.length
        ? ings.map(({ i, st }) => `<button class="ing ${st}" data-ing="${esc(i)}" ${st === "always" ? "disabled" : ""}><span class="mark">${st === "miss" ? "✕" : "✓"}</span><span class="lbl">${esc(i)}</span><span class="hint">${hint[st]}</span></button>`).join("")
        : `<div class="empty">Brak listy składników. Dopisz je w arkuszu w kolumnie „Składniki”, rozdzielając średnikami.</div>`}
      ${miss.length ? `<button class="btn" data-act="tolist">Brakujące na listę zakupów (${miss.length})</button>` : ""}
    </div>

    <div class="section"><h3>Zaplanuj</h3>
      <div class="row">
        <select class="field grow2" id="planDay" aria-label="Dzień">${dates.map((d, k) => `<option value="${iso(d)}">${k < 7 ? "" : "nast. "}${DAYS[k % 7].toLowerCase()} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}</option>`).join("")}</select>
        <select class="field" id="planMeal" aria-label="Posiłek">${MEALS.map(x => `<option ${x === defMeal ? "selected" : ""}>${x}</option>`).join("")}</select>
      </div>
      <button class="btn primary" data-act="plan">Dodaj do planu</button>
    </div>

    <div class="section"><h3>Po zrobieniu</h3>
      <label class="toggle"><input type="checkbox" id="doneT" ${r.done ? "checked" : ""}> Było robione</label>
      <div class="stars" role="group" aria-label="Ocena">${[1, 2, 3, 4, 5].map(n => `<button class="${n <= r.rate ? "on" : ""}" data-rate="${n}" aria-label="${n} na 5">★</button>`).join("")}</div>
      <textarea id="notes" placeholder="Notatka na następny raz, np. mniej soli, podwójny sos">${esc(r.notes)}</textarea>
    </div>
    <p class="count">${esc(r.type)}${r.cats.length ? " · " + esc(r.cats.join(", ")) : ""}</p>
  </div>`;
}
