// End to end through the real route handlers: sign up with Better Auth, then use the session cookie.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, truncateAll } from "../../../server/db";
import * as authRoute from "../auth/[...all]/route";
import * as householdRoute from "./route";

const db = createDb();
const BASE = "http://localhost:3000";

beforeEach(() => truncateAll(db));
afterAll(() => db.$disconnect());

async function signUp(email: string): Promise<string> {
  const res = await authRoute.POST(new Request(`${BASE}/api/auth/sign-up/email`, {
    method: "POST", headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: "dobre-haslo-123", name: email.split("@")[0] }),
  }));
  expect(res.status).toBe(200);
  const cookie = res.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
  expect(cookie).toContain("session_token");
  return cookie;
}

const call = (method: "GET" | "POST", cookie: string, body?: unknown) =>
  householdRoute[method](new Request(`${BASE}/api/household`, {
    method, headers: { cookie, origin: BASE, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  }));

describe("/api/household", () => {
  it("rejects callers without a session", async () => {
    const res = await call("GET", "");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "unauthorized" });
  });

  it("lets a new user create a household and invite another user into it", async () => {
    const ania = await signUp("ania@example.com");
    expect(await (await call("GET", ania)).json()).toMatchObject({ ok: true, result: { user: { email: "ania@example.com", role: "user" }, household: null } });

    const created = await (await call("POST", ania, { op: "create", name: "Dom" })).json();
    expect(created.result).toMatchObject({ name: "Dom", role: "owner" });
    const { result: invite } = await (await call("POST", ania, { op: "invite" })).json();

    const bartek = await signUp("bartek@example.com");
    const joined = await (await call("POST", bartek, { op: "join", code: invite.code })).json();
    expect(joined.result.members.map((m: { email: string }) => m.email)).toEqual(["ania@example.com", "bartek@example.com"]);
  });

  it("validates the body and reports domain errors with their status", async () => {
    const ania = await signUp("ania@example.com");
    expect((await call("POST", ania, { op: "explode" })).status).toBe(400);
    const res = await call("POST", ania, { op: "leave" });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "no_household", message: expect.stringContaining("gospodarstwa") });
  });

  it("stores accounts in our tables with a hashed password and the default role", async () => {
    await signUp("ania@example.com");
    const user = await db.user.findUniqueOrThrow({ where: { email: "ania@example.com" }, include: { accounts: true } });
    expect(user.role).toBe("user");
    expect(user.accounts[0].providerId).toBe("credential");
    expect(user.accounts[0].password).not.toContain("dobre-haslo-123");
  });
});
