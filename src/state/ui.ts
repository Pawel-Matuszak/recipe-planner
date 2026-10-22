// UI-only state (what's open, filters, search). Sheet data lives in the query cache, not here.
import { effect, signal } from "@preact/signals-react";
import { KEYS, store } from "../data/storage";
import type { Filters } from "../model";

export type Tab = "przepisy" | "plan" | "zakupy" | "spizarnia";

interface Saved { tab: Tab; filters: Omit<Filters, "q" | "arch"> }
const saved = store.get<Saved>(KEYS.ui);

export const tab = signal<Tab>(saved?.tab ?? "przepisy");
export const DEFAULT_FILTERS: Omit<Filters, "q"> = { arch: false, type: "Wszystkie", cat: "", maxTime: 0, can: false, todo: false };
export const filters = signal<Filters>({ q: "", ...DEFAULT_FILTERS, ...(saved?.filters ?? {}) });
export const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => (filters.value = { ...filters.value, [k]: v });

export const openRecipe = signal<string | null>(null);
export const randomMode = signal(false);
export const settingsOpen = signal(false);
export const filtersOpen = signal(false);

export const resetFilters = () => (filters.value = { ...DEFAULT_FILTERS, q: filters.value.q });

/** Shopping list: missing ingredients ticked as bought, kept until "Usuń kupione z listy" moves them to the pantry. */
export const boughtNeeds = signal<string[]>(store.get<string[]>(KEYS.bought) ?? []);

export const pantryQuery = signal("");
export const onlyHave = signal(false);

effect(() => store.set(KEYS.bought, boughtNeeds.value));

effect(() => {
  const { q: _q, arch: _a, ...rest } = filters.value;
  store.set(KEYS.ui, { tab: tab.value, filters: rest });
});
