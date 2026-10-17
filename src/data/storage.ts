// Thin localStorage wrapper: never throws (private mode, quota, disabled storage).
export const KEYS = { config: "rp-config", ui: "rp-ui", cache: "rp-cache-v2", bought: "rp-bought" } as const;

export const store = {
  get<T>(k: string): T | null { try { return JSON.parse(localStorage.getItem(k) ?? "null") as T; } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  clear() { try { localStorage.clear(); } catch { /* ignore */ } },
};
