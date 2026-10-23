// The index's grant on a plan (liveworkspace/docs/one-explorer-contracts.md "Grants"): a ten-minute token naming
// the plan, the level and the tab, which the api and the plan's room check offline. Held by
// @liveworkspace/index-client/browser's item grants: the editor asks for it while the plan's code loads, keeps it
// until a minute before it lapses, and sends it with every request about that plan as `X-Index-Grant` (apiFetch adds
// it), and on the room's upgrade as the ticket. One request per plan and link per ten minutes; the open plan's grant
// is fetched again a minute before it lapses, so a save never waits on it.

import { createItemGrants } from '@liveworkspace/index-client/browser';
import { indexClient } from '../index-client';

export {
  GRANT_RENEW_BEFORE_MS,
  type ItemShare as PlanShare,
} from '@liveworkspace/index-client/browser';

// The window global app/pre-hydration-scripts.ts PLAN_GRANT_BOOT_SCRIPT leaves the early grant on.
export const PLAN_GRANT_BOOT_GLOBAL = '__lpGrant';

const grants = createItemGrants({
  client: () => indexClient,
  bootGlobal: PLAN_GRANT_BOOT_GLOBAL,
  itemsSegment: 'projects',
});

/** A grant the editor already has (the create answers one), kept as if it had been fetched. */
export const seedPlanGrant = grants.seed;
/** The grant on this plan: held while it lasts, else one request shared by every caller meanwhile. Null when the
 *  index refuses (no access, a password needed) or cannot be reached. */
export const planGrant = grants.grant;
/** The held grant, synchronously, while it has not lapsed: for the unload flush, which cannot wait for a request. */
export const heldPlanGrant = grants.held;
/** Why the index last refused this plan (`password_required`, `password_invalid`, `not_found`, ...), or null. */
export const planGrantRefusal = grants.refusal;
/** Keeps the open plan's grant fresh while it stays open; answers the stop. */
export const keepPlanGrantFresh = grants.keepFresh;
/** `/api/projects/<id>[/...]` → the plan id, else null. The create (`POST /api/projects`) names no plan. */
export const planIdOfPath = grants.itemIdOfPath;
/** Adds the plan's grant to a request about one plan that does not carry one already. */
export const withPlanGrant = grants.withGrant;
export const resetPlanGrantsForTests = grants.resetForTests;
