// GET: the caller's household as one snapshot (recipes, pantry, plan, shopping extras).
import { getDb } from "../../../server/db";
import { withHousehold } from "../../../server/http";
import { readState } from "../../../server/kitchen/state";

export const GET = withHousehold(({ user, householdId }) => readState(getDb(), householdId, user));
