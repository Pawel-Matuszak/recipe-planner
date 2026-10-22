// Household rules with no database access (the functional core of the households module).
import { randomInt } from "node:crypto";

export interface Member { userId: string; role: "owner" | "member"; joinedAt: Date }

export type AfterLeave = { kind: "delete" } | { kind: "promote"; userId: string } | { kind: "none" };

/** What happens to a household when a member leaves: the last one out deletes it; it never stays without an owner. */
export function afterLeave(members: Member[], leaving: string): AfterLeave {
  const rest = members.filter(m => m.userId !== leaving);
  if (!rest.length) return { kind: "delete" };
  if (rest.some(m => m.role === "owner")) return { kind: "none" };
  const oldest = [...rest].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())[0];
  return { kind: "promote", userId: oldest.userId };
}

// no 0/O, 1/I/L: invite codes get read out loud and typed on phones
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const INVITE_DAYS = 7;

export const newInviteCode = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** "abcd-efgh " → "ABCDEFGH": codes are shown as XXXX-XXXX but stored without the dash. */
export const normalizeInviteCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export const formatInviteCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
