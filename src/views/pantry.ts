import { DZIALY, groupBy, norm } from "../model";
import { S } from "../state";
import { esc } from "../ui";

export function renderPantry(): string {
  const m = S.model;
  if (!m) return `<div class="empty">Wczytuję spiżarnię…</div>`;
  const q = norm(S.pq);
  const all = [...m.pantry.values()];
  const shown = all.filter(p => (!q || norm(p.name).includes(q)) && (!S.pOnlyHave || p.have || p.always));
  const haveN = all.filter(p => p.have).length;

  let html = `<p class="count">Masz ${haveN} z ${all.length} składników. Szare pozycje zawsze są w domu i nie liczą się jako braki.</p>`;
  if (!shown.length) html += `<div class="empty">Nie ma takiego składnika. Dodaj go poniżej.</div>`;
  for (const [dzial, group] of groupBy(shown, p => p.dzial)) {
    html += `<div class="group"><h3>${esc(dzial)}</h3>${group.sort((a, b) => a.name.localeCompare(b.name, "pl")).map(p => p.always
      ? `<label class="check"><input type="checkbox" checked disabled><span class="lbl">${esc(p.name)}<span class="sub">zawsze mam</span></span></label>`
      : `<label class="check"><input type="checkbox" data-have="${esc(p.name)}" ${p.have ? "checked" : ""}><span class="lbl">${esc(p.name)}</span></label>`).join("")}</div>`;
  }
  html += `<form class="inline-form" id="panForm"><h3>Dodaj składnik</h3>
    <div class="row"><input class="field" id="panName" placeholder="Nazwa, np. kasza bulgur" value="${esc(S.pq)}" autocomplete="off">
    <select class="field" id="panDzial" aria-label="Dział">${DZIALY.map(d => `<option>${d}</option>`).join("")}</select></div>
    <button class="btn primary" type="submit">Dodaj jako „mam”</button></form>`;
  return html;
}
