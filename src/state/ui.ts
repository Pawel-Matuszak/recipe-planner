// UI-only state (what's open, filters, search). Sheet data lives in the query cache, not here.
import { effect, signal } from "@preact/signals";
import { KEYS, store } from "../data/storage";
import type { Filters } from "../model";

export type Tab = "przepisy" | "plan" | "zakupy" | "spizarnia";

interface Saved { tab: Tab; filters: Omit<Filters, "q" | "arch"> }
const saved = store.get<Saved>(KEYS.ui);

export const tab = signal<Tab>(saved?.tab ?? "przepisy");
export const filters = signal<Filters>({ q: "", arch: false, type: "Wszystkie", cat: "", maxTime: 0, can: false, todo: false, ...(saved?.filters ?? {}) });
export const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => (filters.value = { ...filters.value, [k]: v });

export const openRecipe = signal<string | null>(null);
export const randomMode = signal(false);
export const settingsOpen = signal(false);

export const week = signal(0);
export const pickFor = signal<string | null>(null); // plan: date whose picker is open
export const pickMeal = signal("Obiad");

export const pantryQuery = signal("");
export const onlyHave = signal(false);

effect(() => {
  const { q: _q, arch: _a, ...rest } = filters.value;
  store.set(KEYS.ui, { tab: tab.value, filters: rest });
});
