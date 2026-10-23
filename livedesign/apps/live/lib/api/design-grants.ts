// The index's grant on a design (liveworkspace/docs/one-explorer-contracts.md "Grants"): a ten-minute token naming
// the design, the level and the tab, which the api and the design's room check offline. The shared holder
// (`@liveworkspace/index-client/browser` createItemGrants) asks for it while the design's code loads, keeps it until
// a minute before it lapses, and apiFetch sends it with every request about the design as `X-Index-Grant`. The
// boot script (app/pre-hydration-scripts.ts DESIGN_GRANT_BOOT_SCRIPT) leaves an early one on `window.__ldesGrant`.
import { createItemGrants, type ItemShare } from '@liveworkspace/index-client/browser';
import { indexClient } from '../index-client';

export { GRANT_RENEW_BEFORE_MS } from '@liveworkspace/index-client/browser';
export type DesignShare = ItemShare;

const grants = createItemGrants({
  client: () => indexClient,
  bootGlobal: '__ldesGrant',
  itemsSegment: 'designs',
});

export const seedDesignGrant = grants.seed;
export const designGrant = grants.grant;
export const heldDesignGrant = grants.held;
export const designGrantRefusal = grants.refusal;
export const keepDesignGrantFresh = grants.keepFresh;
export const designIdOfPath = grants.itemIdOfPath;
export const withDesignGrant = grants.withGrant;
export const resetDesignGrantsForTests = grants.resetForTests;
