// Talks to our API (GET /api/state, POST /api/actions), or to in-memory demo data.
import { signal } from "@preact/signals-react";
import { applyAction, cloneState, type Action } from "../actions";
import { demoState } from "../mock";
import type { State } from "../model";
import { KEYS, store } from "./storage";

/** Where data comes from. `household` ties cached data to one household, so switching households never mixes them. */
export interface Config { url: string; household?: string }
export interface Backend { demo: boolean; all(): Promise<State>; send(a: Action): Promise<void> }

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** Errors worth retrying: the write is kept until the server accepts it. Anything else means the server rejected it. */
export const isTransient = (e: unknown) =>
  e instanceof ApiError && ["offline", "http", "unauthorized", "bad_response"].includes(e.code);

export const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export const DEMO_URL = "demo";
export const SERVER_URL = "/api";

function loadConfig(): Config | null {
  if (process.env.NEXT_PUBLIC_DEMO === "1") return { url: DEMO_URL };
  const c = store.get<Config>(KEYS.config);
  // an Apps Script address saved by an older version is dropped: the user signs in instead
  return c && (c.url === DEMO_URL || c.url === SERVER_URL) ? c : null;
}

/** Current data source; null until the user signs in (or picks the demo) in Settings. */
export const config = signal<Config | null>(loadConfig());

export function setConfig(c: Config | null) {
  config.value = c;
  if (c) store.set(KEYS.config, c);
}

export function backendFor(c: Config): Backend {
  return c.url === DEMO_URL ? demoBackend() : httpBackend(c);
}

function httpBackend(c: Config): Backend {
  async function request(path: string, init?: RequestInit) {
    let res: Response;
    try {
      res = await fetch(c.url + path, { credentials: "same-origin", ...init });
    } catch {
      throw new ApiError("offline", "Brak połączenia z internetem.");
    }
    if (res.status === 401) throw new ApiError("unauthorized", "Sesja wygasła. Zaloguj się ponownie w Ustawieniach.");
    if (res.status >= 500) throw new ApiError("http", `Serwer odpowiedział kodem ${res.status}. Spróbuję ponownie.`);
    let body: { ok?: boolean; error?: string; message?: string; result?: unknown };
    try {
      body = await res.json();
    } catch {
      throw new ApiError("bad_response", "Serwer zwrócił nieoczekiwaną odpowiedź.");
    }
    if (body.error) throw new ApiError(body.error, body.message || body.error);
    return body;
  }
  return {
    demo: false,
    async all() {
      return (await request("/state")).result as State;
    },
    async send(a) {
      await request("/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) });
    },
  };
}

let demoData: State | null = null;
function demoBackend(): Backend {
  demoData ??= demoState();
  const wait = () => new Promise(r => setTimeout(r, 120));
  return {
    demo: true,
    async all() { await wait(); return cloneState(demoData!); },
    async send(a) { await wait(); applyAction(demoData!, a); },
  };
}
