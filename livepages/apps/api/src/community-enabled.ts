import type { Env } from './types';

// The Community's remote off switch (docs/specs/025-community/community.md "Turning the Community off"): the worker's
// COMMUNITY_ENABLED set to false, 0 or off turns it off; unset or anything else leaves it on, so a self-host needs
// nothing. Read on every request, so changing the variable or secret takes effect without redeploying the apps.
const OFF = new Set(['false', '0', 'off']);

export function communityEnabled(env: Pick<Env, 'COMMUNITY_ENABLED'>): boolean {
  return !OFF.has(env.COMMUNITY_ENABLED?.trim().toLowerCase() ?? '');
}
