import { DEMO_URL, loadConfig } from "../api";
import { S } from "../state";
import { esc } from "../ui";

export function renderSettings(): string {
  const c = loadConfig();
  const first = !c;
  const url = c && c.url !== DEMO_URL ? c.url : "";
  return `<div class="wrap">
    <div class="sheet-head">${first ? "<span></span>" : `<button class="btn ghost" data-act="closeSettings">‹ Wróć</button>`}</div>
    <h2>${first ? "Połącz z arkuszem" : "Ustawienia"}</h2>
    <p class="lead">Apka czyta i zapisuje Twój arkusz „Obiadki2” przez skrypt Apps Script. Adres i token dostaniesz po wdrożeniu skryptu (instrukcja w README repozytorium).</p>
    <form class="inline-form" id="settingsForm">
      <label class="lbl-field" for="cfgUrl">Adres wdrożenia (kończy się na /exec)</label>
      <input class="field" id="cfgUrl" type="url" inputmode="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(url)}" required autocomplete="off">
      <label class="lbl-field" for="cfgToken">Token</label>
      <input class="field" id="cfgToken" type="password" placeholder="API_TOKEN ze skryptu" value="${esc(c && c.url !== DEMO_URL ? c.token : "")}" required autocomplete="off">
      <button class="btn primary" type="submit">Zapisz i połącz</button>
      <p class="form-msg" id="settingsMsg" role="status">${S.conn === "error" && S.connMsg ? esc(S.connMsg) : ""}</p>
    </form>
    <div class="section"><h3>Bez arkusza</h3>
      <button class="btn" data-act="demo">Wypróbuj na przykładowych danych</button>
      ${S.demo ? `<p class="count">Działa tryb demo. Zmiany znikną po odświeżeniu strony.</p>` : ""}
    </div>
    ${first ? "" : `<div class="section"><h3>Pamięć telefonu</h3><button class="btn ghost" data-act="forget">Zapomnij adres, token i zapisane dane</button></div>`}
  </div>`;
}
