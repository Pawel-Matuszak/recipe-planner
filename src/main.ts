import "./styles.css";
import { registerSW } from "virtual:pwa-register";
import { applyAction, cloneTables, type Action } from "./actions";
import { ApiError, backendFor, DEMO_URL, loadConfig, saveConfig, store, SyncQueue, type Backend, type Config } from "./api";
import { buildModel, filterRecipes, ingState, missingOf, randomPool, DAYS } from "./model";
import { byId, loadCache, S, saveUI, setTables, type Tab } from "./state";
import { $, ICON, toast } from "./ui";
import { renderHeader } from "./views/header";
import { renderPantry } from "./views/pantry";
import { picker, renderPlan } from "./views/plan";
import { renderRecipes } from "./views/recipes";
import { renderSettings } from "./views/settings";
import { renderRecipeSheet } from "./views/sheet";
import { renderShopping } from "./views/shopping";

registerSW({ immediate: true });

/* ---------- backend & sync ---------- */
let config: Config | null = loadConfig();
let backend: Backend | null = config ? backendFor(config) : null;
S.demo = !!backend?.demo;

const queue = new SyncQueue(() => backend, (state, dropped) => {
  S.sync = { ...state };
  if (state.error && S.conn !== "ok") { S.conn = "error"; S.connMsg = state.error; }
  if (dropped) toast("Arkusz odrzucił zmianę. Odświeżam dane.");
  if (dropped || (!state.pending && !state.error)) void refresh(false);
  else renderHeaderOnly();
});

/** Optimistic write: apply locally, persist, queue for the sheet. */
function act(a: Action) {
  if (!S.tables) return;
  applyAction(S.tables, a);
  setTables(S.tables);
  S.sync.pending = queue.items.length + 1;
  queue.push(a);
}

async function refresh(manual: boolean) {
  if (!backend) { S.conn = "setup"; render(); return; }
  if (queue.items.length) { void queue.flush(); if (queue.items.length && !manual) return; }
  S.conn = "busy";
  renderHeaderOnly();
  try {
    const t = await backend.all();
    // keep local changes that haven't reached the sheet yet
    const merged = cloneTables(t);
    queue.items.forEach(a => applyAction(merged, a));
    setTables(merged);
    S.conn = "ok";
    S.connMsg = "";
    if (manual) toast("Odświeżono z arkusza");
  } catch (e) {
    S.conn = "error";
    S.connMsg = e instanceof ApiError ? e.message : "Nie udało się połączyć z arkuszem.";
  }
  render();
}

function connect(c: Config) {
  const switching = !config || config.url !== c.url;
  config = c;
  saveConfig(c);
  backend = backendFor(c);
  S.demo = backend.demo;
  if (switching) {
    queue.items = [];
    store.set("rp-queue", []);
    S.tables = null;
    S.model = null;
  }
}

/* ---------- render ---------- */
const TABS: [Tab, string][] = [["przepisy", "Przepisy"], ["plan", "Plan"], ["zakupy", "Zakupy"], ["spizarnia", "Spiżarnia"]];

function renderHeaderOnly() {
  const el = $("#top")!;
  const focus = document.activeElement as HTMLInputElement | null;
  const id = focus?.id, caret = focus?.selectionStart ?? null;
  el.innerHTML = renderHeader();
  if (id === "q" || id === "pq") {
    const i = $<HTMLInputElement>("#" + id)!;
    i.focus();
    if (caret !== null) i.setSelectionRange(caret, caret);
  }
}

function renderMain() {
  $("#main")!.innerHTML =
    S.tab === "przepisy" ? renderRecipes() : S.tab === "plan" ? renderPlan() : S.tab === "zakupy" ? renderShopping() : renderPantry();
}

function renderOverlay() {
  const sh = $("#sheet")!;
  const settings = S.settingsOpen || S.conn === "setup";
  const html = settings ? renderSettings() : renderRecipeSheet();
  if (!html) {
    sh.hidden = true;
    sh.innerHTML = "";
    document.body.classList.remove("locked");
    return;
  }
  const top = sh.scrollTop;
  sh.innerHTML = html;
  sh.hidden = false;
  sh.scrollTop = top;
  document.body.classList.add("locked");
}

function render() {
  $("#tabs")!.innerHTML = TABS.map(([k, l]) => `<button data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ""}>${ICON[k]}<span>${l}</span></button>`).join("");
  renderHeaderOnly();
  renderMain();
  renderOverlay();
}

/* ---------- interactions ---------- */
function randomPick() {
  if (!S.model) return;
  const pool = randomPool(S.model, filterRecipes(S.model, S.f), S.f.type === "Wszystkie" && !S.f.q);
  if (!pool.length) { toast("Brak dań pasujących do filtrów"); return; }
  let pick = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && pick.id === S.open) pick = pool.find(r => r.id !== S.open)!;
  S.randomMode = true;
  S.open = pick.id;
  renderOverlay();
}

function setRecipe(id: string, field: "done" | "rate" | "notes", value: boolean | number | string) {
  const r = byId(id);
  if (r) act({ action: "setRecipeField", by: r.by, key: r.key, field, value });
}

function addPlan(date: string, meal: string, id: string, text: string) {
  act({ action: "addPlan", date, meal, id, text });
  const day = DAYS[(new Date(date + "T12:00").getDay() + 6) % 7];
  toast(`Dodano do planu: ${day.toLowerCase()}, ${meal.toLowerCase()}`);
}

document.addEventListener("click", e => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("button, [data-open]");
  if (!t) return;
  const d = t.dataset;
  const m = S.model;

  if (d.tab) { S.tab = d.tab as Tab; S.pickFor = null; saveUI(); window.scrollTo(0, 0); render(); return; }
  if (d.open) { S.randomMode = false; S.open = d.open; renderOverlay(); return; }
  if (d.type) { S.f.type = d.type; saveUI(); render(); return; }
  if (d.time) { const v = +d.time; S.f.maxTime = S.f.maxTime === v ? 0 : v; saveUI(); render(); return; }
  if (d.week) { S.week += +d.week; S.pickFor = null; render(); return; }
  if (d.pick !== undefined) {
    S.pickFor = d.pick || null; S.pickQ = "";
    renderMain();
    if (d.pick) $<HTMLInputElement>("#pickQ")?.focus();
    return;
  }
  if (d.pickr && S.pickFor) { S.pickMeal = $<HTMLSelectElement>("#pickMeal")!.value; addPlan(S.pickFor, S.pickMeal, d.pickr, ""); S.pickFor = null; render(); return; }
  if (d.picktext && S.pickFor) { S.pickMeal = $<HTMLSelectElement>("#pickMeal")!.value; addPlan(S.pickFor, S.pickMeal, "", S.pickQ.trim()); S.pickFor = null; render(); return; }
  if (d.unplan && m) { const p = m.plan[+d.unplan]; act({ action: "removePlan", date: p.date, meal: p.meal, id: p.id, text: p.text }); render(); return; }
  if (d.rate && S.open) { const r = byId(S.open)!; const v = +d.rate === r.rate ? 0 : +d.rate; setRecipe(r.id, "rate", v || ""); renderOverlay(); return; }
  if (d.ing && m) { act({ action: "setPantry", name: d.ing, have: ingState(m, d.ing) === "miss" }); render(); return; }

  switch (d.act) {
    case "refresh": void refresh(true); break;
    case "settings": S.settingsOpen = true; renderOverlay(); break;
    case "closeSettings": S.settingsOpen = false; renderOverlay(); break;
    case "random": randomPick(); break;
    case "close": S.open = null; S.randomMode = false; render(); break;
    case "can": S.f.can = !S.f.can; saveUI(); render(); break;
    case "todo": S.f.todo = !S.f.todo; saveUI(); render(); break;
    case "arch": S.f.arch = !S.f.arch; render(); break;
    case "onlyhave": S.pOnlyHave = !S.pOnlyHave; render(); break;
    case "tolist": if (m && S.open) { const miss = missingOf(m, byId(S.open)!); act({ action: "addExtra", items: miss }); toast(`Na liście zakupów: +${miss.length}`); renderOverlay(); } break;
    case "plan": if (S.open) addPlan($<HTMLSelectElement>("#planDay")!.value, $<HTMLSelectElement>("#planMeal")!.value, S.open, ""); break;
    case "clearbought": act({ action: "clearBoughtExtra" }); render(); break;
    case "demo": connect({ url: DEMO_URL, token: "" }); S.settingsOpen = false; S.conn = "loading"; render(); void refresh(false); break;
    case "forget":
      try { localStorage.clear(); } catch { /* ignore */ }
      config = null; backend = null; queue.items = []; S.tables = null; S.model = null; S.demo = false; S.settingsOpen = false; S.conn = "setup";
      render();
      break;
  }
});

document.addEventListener("input", e => {
  const t = e.target as HTMLInputElement;
  if (t.id === "q") { S.f.q = t.value; renderMain(); }
  if (t.id === "pq") { S.pq = t.value; renderMain(); }
  if (t.id === "pickQ") {
    S.pickQ = t.value;
    const form = t.closest(".inline-form")!;
    const pos = t.selectionStart;
    form.outerHTML = picker();
    const i = $<HTMLInputElement>("#pickQ")!;
    i.focus();
    if (pos !== null) i.setSelectionRange(pos, pos);
  }
});

document.addEventListener("change", e => {
  const t = e.target as HTMLInputElement;
  const d = t.dataset;
  if (t.id === "cat") { S.f.cat = t.value; saveUI(); render(); }
  if (t.id === "pickMeal") S.pickMeal = t.value;
  if (d.have) { act({ action: "setPantry", name: d.have, have: t.checked }); renderHeaderOnly(); }
  if (d.buy) { act({ action: "setPantry", name: d.buy, have: true }); toast(`${d.buy}: kupione`); setTimeout(renderMain, 350); }
  if (d.extra && S.model) { const x = S.model.extra[+d.extra]; act({ action: "setExtra", item: x.item, bought: t.checked }); renderMain(); }
  if (t.id === "doneT" && S.open) setRecipe(S.open, "done", t.checked);
  if (t.id === "notes" && S.open) {
    const r = byId(S.open);
    if (r && r.notes !== t.value) { setRecipe(S.open, "notes", t.value); toast("Notatka zapisana"); }
  }
});

document.addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target as HTMLFormElement;
  if (f.id === "extraForm") {
    const v = $<HTMLInputElement>("#extraIn")!.value.trim();
    if (v) { act({ action: "addExtra", items: [v] }); renderMain(); $<HTMLInputElement>("#extraIn")?.focus(); }
  }
  if (f.id === "panForm") {
    const name = $<HTMLInputElement>("#panName")!.value.trim();
    if (!name) return;
    if (S.model?.pantry.has(name.toLowerCase())) { toast(`„${name}” już jest w spiżarni`); return; }
    act({ action: "addPantry", name, dzial: $<HTMLSelectElement>("#panDzial")!.value });
    S.pq = "";
    toast(`Dodano: ${name}`);
    render();
  }
  if (f.id === "settingsForm") {
    const c = { url: $<HTMLInputElement>("#cfgUrl")!.value.trim(), token: $<HTMLInputElement>("#cfgToken")!.value.trim() };
    const msg = $("#settingsMsg")!;
    msg.textContent = "Sprawdzam połączenie…";
    try {
      const t = await backendFor(c).all();
      buildModel(t); // throws on a malformed payload
      connect(c);
      setTables(t);
      S.conn = "ok"; S.connMsg = ""; S.settingsOpen = false;
      toast("Połączono z arkuszem");
      render();
    } catch (err) {
      msg.textContent = err instanceof ApiError ? err.message : "Nie udało się połączyć. Sprawdź adres i token.";
    }
  }
});

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (S.open) { S.open = null; render(); }
  else if (S.settingsOpen) { S.settingsOpen = false; renderOverlay(); }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && backend && Date.now() - S.savedAt > 60_000) void refresh(false);
});

/* ---------- boot ---------- */
if (backend && loadCache()) S.conn = "loading";
if (!backend) S.conn = "setup";
S.sync.pending = queue.items.length;
render();
if (backend) void refresh(false);
