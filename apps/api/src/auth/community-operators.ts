// Community operators (docs/specs/025-community/community.md "Reports and moderation"; blueprint §5 G6): the
// verified Clerk ids listed in the worker's COMMUNITY_OPERATOR_IDS may hide, restore and review posts. Unset or
// empty means nobody. Its own module because both the Community routes and the share resolve ask it.

import type { Env } from '../types';

export function isCommunityOperator(env: Env, userId: string | null): boolean {
  if (!userId || !env.COMMUNITY_OPERATOR_IDS) return false;
  return env.COMMUNITY_OPERATOR_IDS.split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}
