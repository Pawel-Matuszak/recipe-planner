import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, truncateAll } from "../db";
import { createHousehold, createInvite, joinHousehold, leaveHousehold, myHousehold } from "./service";

const db = createDb();
const user = (id: string) => db.user.create({ data: { id, name: id, email: `${id}@example.com` } });

beforeEach(async () => {
  await truncateAll(db);
  await Promise.all(["ania", "bartek", "celina"].map(user));
});
afterAll(() => db.$disconnect());

describe("households", () => {
  it("are created with their creator as owner", async () => {
    const h = await createHousehold(db, "ania", "  Dom  ");
    expect(h).toMatchObject({ name: "Dom", role: "owner", members: [{ id: "ania", role: "owner" }] });
  });

  it("are joined with an invite code, however it is typed", async () => {
    await createHousehold(db, "ania", "Dom");
    const { code } = await createInvite(db, "ania");
    const h = await joinHousehold(db, "bartek", code.toLowerCase().replace("-", " "));
    expect(h.role).toBe("member");
    expect(h.members.map(x => x.id)).toEqual(["ania", "bartek"]);
  });

  it("reject expired or unknown codes", async () => {
    await createHousehold(db, "ania", "Dom");
    const past = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const { code } = await createInvite(db, "ania", past);
    await expect(joinHousehold(db, "bartek", code)).rejects.toMatchObject({ code: "invalid_invite" });
    await expect(joinHousehold(db, "bartek", "AAAA-AAAA")).rejects.toMatchObject({ code: "invalid_invite" });
  });

  it("allow one household per user", async () => {
    await createHousehold(db, "ania", "Dom");
    await createHousehold(db, "bartek", "Mieszkanie");
    const { code } = await createInvite(db, "ania");
    await expect(joinHousehold(db, "bartek", code)).rejects.toMatchObject({ code: "already_in_household", status: 409 });
    await expect(createHousehold(db, "ania", "Drugi dom")).rejects.toMatchObject({ code: "already_in_household" });
  });

  it("pass ownership on when the owner leaves, and disappear with their data when the last member leaves", async () => {
    const { id } = await createHousehold(db, "ania", "Dom");
    const { code } = await createInvite(db, "ania");
    await joinHousehold(db, "bartek", code);
    await joinHousehold(db, "celina", code);
    await db.shoppingExtra.create({ data: { id: crypto.randomUUID(), householdId: id, item: "chleb" } });

    await leaveHousehold(db, "ania");
    expect(await myHousehold(db, "ania")).toBeNull();
    expect((await myHousehold(db, "bartek"))?.role).toBe("owner");

    await leaveHousehold(db, "bartek");
    await leaveHousehold(db, "celina");
    expect(await db.household.count()).toBe(0);
    expect(await db.shoppingExtra.count()).toBe(0);
  });

  it("can't be left by someone who isn't in one", async () => {
    await expect(leaveHousehold(db, "ania")).rejects.toMatchObject({ code: "no_household" });
  });
});
