// GET: the caller's household (or null). POST { op }: create, invite, join, leave.
import { z } from "zod";
import { getDb } from "../../../server/db";
import { createHousehold, createInvite, joinHousehold, leaveHousehold, myHousehold } from "../../../server/households/service";
import { readBody, withUser } from "../../../server/http";

const Op = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), name: z.string().max(80) }),
  z.object({ op: z.literal("invite") }),
  z.object({ op: z.literal("join"), code: z.string().max(20) }),
  z.object({ op: z.literal("leave") }),
]);

export const GET = withUser(async user => ({ user, household: await myHousehold(getDb(), user.id) }));

export const POST = withUser(async (user, req) => {
  const db = getDb();
  const op = await readBody(req, Op);
  switch (op.op) {
    case "create": return createHousehold(db, user.id, op.name);
    case "invite": return createInvite(db, user.id);
    case "join": return joinHousehold(db, user.id, op.code);
    case "leave": return leaveHousehold(db, user.id);
  }
});
