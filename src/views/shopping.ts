import { groupBy, iso, shoppingItems, weekDates } from "../model";
import { S } from "../state";
import { esc } from "../ui";
import { weekNav } from "./plan";

export function renderShopping(): string {
  const m = S.model;
  if (!m) return `<div class="empty">Wczytuję…</div>`;
  const dates = weekDates(S.week).map(iso);
  const items = shoppingItems(m, dates);
  const anyPlanned = m.plan.some(p => dates.includes(p.date) && p.id);

  let html = weekNav("Plan ") + `<div class="section"><h3>Brakuje do zaplanowanych dań</h3>`;
  if (!items.length) {
    html += `<div class="empty">${anyPlanned ? "Masz wszystko do dań z planu na ten tydzień." : "W planie na ten tydzień nie ma dań z przepisów. Dodaj je w zakładce Plan."}</div>`;
  }
  for (const [dzial, group] of groupBy(items, i => i.dzial)) {
    html += `<div class="group"><h3>${esc(dzial)}</h3>${group.sort((a, b) => a.name.localeCompare(b.name, "pl")).map(it => `
      <label class="check"><input type="checkbox" data-buy="${esc(it.name)}"><span class="lbl">${esc(it.name)}<span class="sub">do: ${esc(it.for.join(", "))}</span></span></label>`).join("")}</div>`;
  }
  if (items.length) html += `<p class="count">Odhaczenie oznacza składnik jako „mam” w spiżarni.</p>`;
  html += `</div><div class="section"><h3>Dopisane ręcznie</h3>
    <form class="search" id="extraForm"><input id="extraIn" placeholder="Np. papier do pieczenia" autocomplete="off" enterkeyhint="done"><button class="iconbtn primary" type="submit">Dodaj</button></form>
    ${m.extra.length
      ? m.extra.map((x, k) => `<label class="check ${x.bought ? "done" : ""}"><input type="checkbox" data-extra="${k}" ${x.bought ? "checked" : ""}><span class="lbl">${esc(x.item)}</span></label>`).join("")
      : `<div class="empty">Pusto. Dopisz coś powyżej albo w przepisie użyj „Brakujące na listę zakupów”.</div>`}
    ${m.extra.some(x => x.bought) ? `<button class="btn ghost" data-act="clearbought">Usuń kupione z listy</button>` : ""}
  </div>`;
  return html;
}
