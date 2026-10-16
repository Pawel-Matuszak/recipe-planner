import { S } from "../state";
import { esc, ICON } from "../ui";

const TITLES = { przepisy: "Obiadki", plan: "Plan tygodnia", zakupy: "Lista zakupów", spizarnia: "Spiżarnia" };

function status() {
  const p = S.sync.pending;
  let cls = "", txt = "Łączę…";
  if (S.conn === "busy") { cls = "busy"; txt = "Synchronizuję…"; }
  else if (S.conn === "error") { cls = "err"; txt = S.tables ? "Offline: dane z telefonu" : "Brak połączenia"; }
  else if (S.conn === "ok") { cls = "ok"; txt = S.demo ? "Tryb demo" : "Połączono z arkuszem"; }
  if (p) { cls = "busy"; txt += ` · ${p} ${p === 1 ? "zmiana czeka" : "zmian czeka"}`; }
  return `<span class="status"><span class="dot ${cls}"></span>${txt}</span>`;
}

export function renderHeader(): string {
  const m = S.model;
  let html = `<div class="brand"><div class="brand-text"><h1>${TITLES[S.tab]}</h1>${status()}</div>
    <div class="row"><button class="iconbtn" data-act="refresh" aria-label="Odśwież z arkusza">${ICON.refresh}</button><button class="iconbtn" data-act="settings" aria-label="Ustawienia">${ICON.settings}</button></div></div>`;

  if (S.tab === "przepisy" && m) {
    const types = ["Wszystkie", ...new Set(m.recipes.map(r => r.type))];
    const cats = [...new Set(m.recipes.flatMap(r => r.cats))].sort((a, b) => a.localeCompare(b, "pl"));
    html += `<div class="search"><input id="q" type="search" placeholder="Szukaj dania lub składnika…" value="${esc(S.f.q)}" autocomplete="off" enterkeyhint="search"><button class="iconbtn primary" data-act="random">Losuj</button></div>
    <div class="chips" role="group" aria-label="Filtry">
      <button class="chip can" data-act="can" aria-pressed="${S.f.can}">Mogę zrobić teraz</button>
      ${[15, 30, 60].map(t => `<button class="chip" data-time="${t}" aria-pressed="${S.f.maxTime === t}">≤ ${t} min</button>`).join("")}
      <button class="chip" data-act="todo" aria-pressed="${S.f.todo}">Jeszcze nie robione</button>
      <select class="chip" id="cat" aria-label="Kategoria"><option value="">Każda kategoria</option>${cats.map(c => `<option ${S.f.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <button class="chip" data-act="arch" aria-pressed="${S.f.arch}">Archiwum</button>
    </div>
    <div class="chips" role="group" aria-label="Typ">${types.map(t => `<button class="chip" data-type="${esc(t)}" aria-pressed="${S.f.type === t}">${esc(t)}</button>`).join("")}</div>`;
  }
  if (S.tab === "spizarnia" && m) {
    html += `<div class="search"><input id="pq" type="search" placeholder="Szukaj składnika…" value="${esc(S.pq)}" autocomplete="off"></div>
    <div class="chips"><button class="chip" data-act="onlyhave" aria-pressed="${S.pOnlyHave}">Tylko to, co mam</button></div>`;
  }

  const msg = S.conn === "error" ? S.connMsg : S.sync.error;
  if (msg) {
    html += `<div class="banner ${S.tables ? "" : "err"}"><span>${esc(msg)}</span><div class="row">
      <button data-act="refresh">Spróbuj ponownie</button><button class="ghost" data-act="settings">Ustawienia</button></div></div>`;
  }
  return html;
}
