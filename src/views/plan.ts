import { DAYS, iso, MEALS, norm, weekDates } from "../model";
import { byId, S } from "../state";
import { esc, fmtDay } from "../ui";
import { missBadge } from "./recipes";

export function weekNav(prefix = ""): string {
  const d = weekDates(S.week);
  return `<div class="weeknav"><button class="btn ghost" data-week="-1" aria-label="Poprzedni tydzień">‹</button>
    <b>${prefix}${fmtDay(d[0])} – ${fmtDay(d[6])}</b><button class="btn ghost" data-week="1" aria-label="Następny tydzień">›</button></div>`;
}

export function renderPlan(): string {
  const m = S.model;
  if (!m) return `<div class="empty">Wczytuję plan…</div>`;
  const today = iso(new Date());
  const days = weekDates(S.week).map((d, i) => {
    const ds = iso(d);
    const items = m.plan.map((p, k) => ({ p, k })).filter(x => x.p.date === ds).sort((a, b) => MEALS.indexOf(a.p.meal) - MEALS.indexOf(b.p.meal));
    return `<section class="day ${ds === today ? "today" : ""}">
      <div class="day-head"><b>${DAYS[i]}</b><span>${fmtDay(d)}${ds === today ? " · dziś" : ""}</span></div>
      ${items.map(({ p, k }) => {
        const r = p.id ? byId(p.id) : undefined;
        const label = r ? `<button class="v link" data-open="${esc(r.id)}">${esc(r.name)}</button>` : `<span class="v">${esc(p.text || p.id)}</span>`;
        return `<div class="meal"><span class="k">${esc(p.meal)}</span>${label}<button class="x" data-unplan="${k}" aria-label="Usuń z planu">×</button></div>`;
      }).join("")}
      ${S.pickFor === ds ? picker() : `<button class="add" data-pick="${ds}">+ dodaj posiłek</button>`}
    </section>`;
  });
  return weekNav() + `<div class="list days">${days.join("")}</div>`;
}

export function picker(): string {
  const q = norm(S.pickQ);
  const opts = S.model!.recipes.filter(r => !r.arch && (!q || norm(r.name).includes(q))).slice(0, 8);
  return `<div class="inline-form">
    <select class="field" id="pickMeal" aria-label="Posiłek">${MEALS.map(m => `<option ${m === S.pickMeal ? "selected" : ""}>${m}</option>`).join("")}</select>
    <input class="field" id="pickQ" placeholder="Wpisz nazwę dania…" value="${esc(S.pickQ)}" autocomplete="off">
    <div class="list" id="pickList">${opts.map(r => `<button class="card" data-pickr="${esc(r.id)}"><span class="name">${esc(r.name)}</span>${missBadge(r)}</button>`).join("")}</div>
    <div class="row">${q ? `<button class="btn" data-picktext="1">Dodaj jako tekst: „${esc(S.pickQ)}”</button>` : ""}<button class="btn ghost" data-pick="">Anuluj</button></div>
  </div>`;
}
