import { describe, expect, it } from "vitest";
import { afterLeave, formatInviteCode, newInviteCode, normalizeInviteCode, type Member } from "./rules";

const m = (userId: string, role: Member["role"], day: number): Member => ({ userId, role, joinedAt: new Date(2026, 0, day) });

describe("afterLeave", () => {
  it("deletes the household when the last member leaves", () => {
    expect(afterLeave([m("a", "owner", 1)], "a")).toEqual({ kind: "delete" });
  });

  it("promotes the longest-standing member when the only owner leaves", () => {
    expect(afterLeave([m("a", "owner", 1), m("c", "member", 3), m("b", "member", 2)], "a")).toEqual({ kind: "promote", userId: "b" });
  });

  it("changes nothing when another owner stays or a member leaves", () => {
    expect(afterLeave([m("a", "owner", 1), m("b", "owner", 2)], "a")).toEqual({ kind: "none" });
    expect(afterLeave([m("a", "owner", 1), m("b", "member", 2)], "b")).toEqual({ kind: "none" });
  });
});

describe("invite codes", () => {
  it("are 8 unambiguous characters, shown as XXXX-XXXX and accepted however they are typed", () => {
    const code = newInviteCode();
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(normalizeInviteCode(` ${formatInviteCode(code).toLowerCase()} `)).toBe(code);
  });
});
