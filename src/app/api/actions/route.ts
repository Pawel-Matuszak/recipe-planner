// POST: one write from the app's queue, applied in a transaction (see src/actions.ts for the list).
import { ActionSchema } from "../../../actions";
import { getDb } from "../../../server/db";
import { readBody, withHousehold } from "../../../server/http";
import { runAction } from "../../../server/kitchen/actions";

export const POST = withHousehold(async (ctx, req) => {
  const action = await readBody(req, ActionSchema);
  await getDb().$transaction(tx => runAction(tx, ctx, action));
});
