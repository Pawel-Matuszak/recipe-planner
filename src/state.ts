import { buildModel, type Filters, type Model, type Tables } from "./model";
import { store, type SyncState } from "./api";

export type Tab = "przepisy" | "plan" | "zakupy" | "spizarnia";
export type Conn = "loading" | "ok" | "busy" | "error" | "setup";

const UI_KEY = "rp-ui";
const CACHE_KEY = "rp-cache";

interface Saved { tab: Tab; filters: Omit<Filters, "q" | "arch"> }
const saved = store.get<Saved>(UI_KEY);

export const S = {
  tables: null as Tables | null,
  model: null as Model | null,
  savedAt: 0,
  conn: "loading" as Conn,
  connMsg: "",
  sync: { pending: 0, offline: false, error: "" } as SyncState,
  demo: false,

  tab: (saved?.tab ?? "przepisy") as Tab,
  f: { q: "", arch: false, type: "Wszystkie", cat: "", maxTime: 0, can: false, todo: false, ...(saved?.filters ?? {}) } as Filters,

  open: null as string | null,   // recipe id shown in the sheet
  randomMode: false,
  settingsOpen: false,
  week: 0,
  pickFor: null as string | null, // plan: date whose picker is open
  pickQ: "",
  pickMeal: "Obiad",
  pq: "",                          // pantry search
  pOnlyHave: false,
};

export function saveUI() {
  const { q: _q, arch: _a, ...filters } = S.f;
  store.set(UI_KEY, { tab: S.tab, filters });
}

export function setTables(t: Tables, at = Date.now()) {
  S.tables = t;
  S.model = buildModel(t);
  S.savedAt = at;
  store.set(CACHE_KEY, { t, at });
}

export function loadCache(): boolean {
  const c = store.get<{ t: Tables; at: number }>(CACHE_KEY);
  if (!c?.t) return false;
  S.tables = c.t;
  S.model = buildModel(c.t);
  S.savedAt = c.at;
  return true;
}

export const byId = (id: string) => S.model?.recipes.find(r => r.id === id);
