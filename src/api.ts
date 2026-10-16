// Talks to the Apps Script web app, plus a persistent queue so changes made offline sync later.
import { applyAction, cloneTables, type Action } from "./actions";
import { demoTables } from "./mock";
import type { Tables } from "./model";

export interface Config { url: string; token: string }
export interface Backend { demo: boolean; all(): Promise<Tables>; send(a: Action): Promise<void> }

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const CONFIG_KEY = "rp-config";
const QUEUE_KEY = "rp-queue";
const store = {
  get<T>(k: string): T | null { try { return JSON.parse(localStorage.getItem(k) ?? "null") as T; } catch { return null; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
export { store };

export const DEMO_URL = "demo";
export function loadConfig(): Config | null {
  if (import.meta.env.MODE === "mock") return { url: DEMO_URL, token: "" };
  const c = store.get<Config>(CONFIG_KEY);
  return c && c.url ? c : null;
}
export const saveConfig = (c: Config) => store.set(CONFIG_KEY, c);

export function backendFor(c: Config): Backend {
  return c.url === DEMO_URL ? demoBackend() : httpBackend(c);
}

function httpBackend(c: Config): Backend {
  async function request(query: string, init?: RequestInit) {
    let res: Response;
    try {
      res = await fetch(c.url + query, init);
    } catch {
      throw new ApiError("offline", "Brak połączenia z internetem albo z Apps Script.");
    }
    if (!res.ok) throw new ApiError("http", `Apps Script odpowiedział kodem ${res.status}.`);
    let body: { ok?: boolean; error?: string; message?: string; data?: Tables };
    try {
      body = await res.json();
    } catch {
      throw new ApiError("bad_response", "Odpowiedź nie jest JSON-em. Sprawdź, czy adres kończy się na /exec, a wdrożenie ma dostęp „Każdy”.");
    }
    if (body.error === "unauthorized") throw new ApiError("unauthorized", "Zły token. Sprawdź go w Ustawieniach.");
    if (body.error) throw new ApiError(body.error, body.message || body.error);
    return body;
  }
  return {
    demo: false,
    async all() {
      const sep = c.url.includes("?") ? "&" : "?";
      const body = await request(`${sep}action=all&token=${encodeURIComponent(c.token)}`);
      return body.data as Tables;
    },
    async send(a) {
      // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight
      await request("", { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ ...a, token: c.token }) });
    },
  };
}

let demoState: Tables | null = null;
function demoBackend(): Backend {
  demoState ??= cloneTables(demoTables());
  const wait = () => new Promise(r => setTimeout(r, 120));
  return {
    demo: true,
    async all() { await wait(); return cloneTables(demoState!); },
    async send(a) { await wait(); applyAction(demoState!, a); },
  };
}

export interface SyncState { pending: number; offline: boolean; error: string }

/** FIFO of writes persisted in localStorage; survives reloads and retries when back online. */
export class SyncQueue {
  items: Action[] = store.get<Action[]>(QUEUE_KEY) ?? [];
  private busy = false;
  state: SyncState = { pending: this.items.length, offline: false, error: "" };

  constructor(private backend: () => Backend | null, private onChange: (s: SyncState, dropped?: Action) => void) {
    window.addEventListener("online", () => this.flush());
  }

  push(a: Action) {
    this.items.push(a);
    this.save();
    void this.flush();
  }

  async flush() {
    const b = this.backend();
    if (this.busy || !b) return;
    this.busy = true;
    while (this.items.length) {
      try {
        await b.send(this.items[0]);
        this.items.shift();
        this.state = { pending: this.items.length, offline: false, error: "" };
        this.save();
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError("unknown", String(e));
        if (["offline", "http", "unauthorized", "bad_response"].includes(err.code)) {
          // keep the write; try again later
          this.state = { pending: this.items.length, offline: err.code === "offline", error: err.message };
          this.onChange(this.state);
          break;
        }
        // the sheet rejected this write (e.g. row not found): drop it so the queue doesn't jam
        const dropped = this.items.shift();
        this.save();
        this.state = { pending: this.items.length, offline: false, error: err.message };
        this.onChange(this.state, dropped);
      }
    }
    this.busy = false;
    this.state.pending = this.items.length;
    this.onChange(this.state);
  }

  private save() { store.set(QUEUE_KEY, this.items); this.state.pending = this.items.length; }
}
