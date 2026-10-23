// Helpers for route-handler tests: sign up through the real Better Auth route and call handlers with the cookie.
import { expect } from "vitest";
import * as authRoute from "../../app/api/auth/[...all]/route";

export const BASE = "http://localhost:3000";

/** Signs up a new user; returns the session cookie and the user's id. */
export async function signUp(email: string): Promise<{ cookie: string; id: string }> {
  const res = await authRoute.POST(new Request(`${BASE}/api/auth/sign-up/email`, {
    method: "POST", headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: "dobre-haslo-123", name: email.split("@")[0] }),
  }));
  expect(res.status).toBe(200);
  const cookie = res.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
  return { cookie, id: (await res.json()).user.id };
}

type Route = (req: Request) => Promise<Response>;

export async function call(route: Route, cookie: string, body?: unknown): Promise<{ status: number; json: any }> {
  const res = await route(new Request(`${BASE}/api/x`, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie, origin: BASE, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return { status: res.status, json: await res.json() };
}
