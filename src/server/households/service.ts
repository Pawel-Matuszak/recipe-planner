// Household use cases: create, invite, join, leave. Each runs in one transaction.
import { Prisma } from "../../generated/prisma/client";
import type { Db } from "../db";
import { DomainError } from "../errors";
import { afterLeave, formatInviteCode, INVITE_DAYS, newInviteCode, normalizeInviteCode } from "./rules";

export interface HouseholdView {
  id: string;
  name: string;
  role: "owner" | "member";
  members: { id: string; name: string; email: string; role: "owner" | "member" }[];
}

const alreadyIn = () => new DomainError("already_in_household", "Należysz już do gospodarstwa. Najpierw je opuść.", 409);
const notIn = () => new DomainError("no_household", "Nie należysz do żadnego gospodarstwa.", 404);

/** The household of a user, or null. Other modules use this to scope every query. */
export async function householdIdOf(db: Pick<Db, "householdMember">, userId: string): Promise<string | null> {
  return (await db.householdMember.findUnique({ where: { userId }, select: { householdId: true } }))?.householdId ?? null;
}

export async function myHousehold(db: Db, userId: string): Promise<HouseholdView | null> {
  const m = await db.householdMember.findUnique({
    where: { userId },
    include: { household: { include: { members: { include: { user: true }, orderBy: { joinedAt: "asc" } } } } },
  });
  if (!m) return null;
  return {
    id: m.household.id, name: m.household.name, role: m.role,
    members: m.household.members.map(x => ({ id: x.user.id, name: x.user.name, email: x.user.email, role: x.role })),
  };
}

export async function createHousehold(db: Db, userId: string, name: string): Promise<HouseholdView> {
  const clean = name.trim();
  if (!clean) throw new DomainError("invalid", "Podaj nazwę gospodarstwa.");
  try {
    await db.household.create({ data: { name: clean, members: { create: { userId, role: "owner" } } } });
  } catch (e) {
    throw isUniqueViolation(e) ? alreadyIn() : e;
  }
  return (await myHousehold(db, userId))!;
}

export async function createInvite(db: Db, userId: string, now = new Date()) {
  const householdId = await householdIdOf(db, userId);
  if (!householdId) throw notIn();
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000);
  const invite = await db.householdInvite.create({ data: { code: newInviteCode(), householdId, createdById: userId, expiresAt } });
  return { code: formatInviteCode(invite.code), expiresAt: invite.expiresAt };
}

export async function joinHousehold(db: Db, userId: string, code: string, now = new Date()): Promise<HouseholdView> {
  const invite = await db.householdInvite.findUnique({ where: { code: normalizeInviteCode(code) } });
  if (!invite || invite.expiresAt <= now) throw new DomainError("invalid_invite", "Ten kod zaproszenia jest nieprawidłowy albo wygasł.");
  try {
    await db.householdMember.create({ data: { householdId: invite.householdId, userId, role: "member" } });
  } catch (e) {
    throw isUniqueViolation(e) ? alreadyIn() : e;
  }
  return (await myHousehold(db, userId))!;
}

/** Leaves the household; the last member out deletes it with its pantry and plan, and an owner is always kept. */
export async function leaveHousehold(db: Db, userId: string): Promise<void> {
  await db.$transaction(async tx => {
    const me = await tx.householdMember.findUnique({ where: { userId } });
    if (!me) throw notIn();
    // lock the household's members so two people leaving at once can't both skip the promotion
    await tx.$queryRaw`SELECT 1 FROM household_member WHERE household_id = ${me.householdId}::uuid FOR UPDATE`;
    const members = await tx.householdMember.findMany({ where: { householdId: me.householdId } });
    const next = afterLeave(members, userId);
    await tx.householdMember.delete({ where: { householdId_userId: { householdId: me.householdId, userId } } });
    if (next.kind === "delete") await tx.household.delete({ where: { id: me.householdId } });
    if (next.kind === "promote") {
      await tx.householdMember.update({ where: { householdId_userId: { householdId: me.householdId, userId: next.userId } }, data: { role: "owner" } });
    }
  });
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
