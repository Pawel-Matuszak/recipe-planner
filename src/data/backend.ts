// Talks to the Apps Script web app (apps-script/Code.gs), or to in-memory demo data.
import { signal } from "@preact/signals";
import { applyAction, cloneTables, type Action } from "../actions";
import { demoTables } from "../mock";
import type { Tables } from "../model";
import { KEYS, store } from "./storage";

export interface Config { url: string; token: string }
export interface Backend { demo: boolean; all(): Promise<Tables>; send(a: Action): Promise<void> }

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** Errors worth retrying: the write is kept until the sheet accepts it. Anything else means the sheet rejected it. */
export const isTransient = (e: unknown) =>
  e instanceof ApiError && ["offline", "http", "unauthorized", "bad_response"].includes(e.code);

export const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export const DEMO_URL = "demo";

function loadConfig(): Config | null {
  if (import.meta.env.MODE === "mock") return { url: DEMO_URL, token: "" };
  const c = store.get<Config>(KEYS.config);
  return c && c.url ? c : null;
}

/** Current connection; null until the user sets it up in Settings. */
export const config = signal<Config | null>(loadConfig());

export function setConfig(c: Config | null) {
  config.value = c;
  if (c) store.set(KEYS.config, c);
}

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
