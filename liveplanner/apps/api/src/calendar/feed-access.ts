// Whether a calendar feed's person may still read its plan (docs/specs/026-plan/calendar-feed.md "Who may have one";
// blueprint calendar-feed.md "Behaviour and state"), asked on every fetch: their teams from accounts now, and their
// grant on the plan from the index now, as the owner or a team member (the app's key, delegated, with no share
// link). Neither answer comes from a cache: `requestGrant`'s would outlive a removal by up to its grant's life.

import { isAccountId, readAccountTeams } from '@liveworkspace/auth-client';
import { IndexError } from '@liveworkspace/index-client';
import { accountCredentials } from '../auth/accounts';
import { indexFor } from '../index-service';
import type { Env } from '../types';

// `ok`: serve the feed; `refused`: answer as an unknown token; `unavailable`: accounts or the index could not say.
export type FeedAccess = 'ok' | 'refused' | 'unavailable';

export async function calendarFeedAccess(
  env: Env,
  planId: string,
  personId: string,
): Promise<FeedAccess> {
  // An account only: the index never acts for a guest, and a guest's identity lapses with its token.
  if (!isAccountId(personId)) return 'refused';
  const credentials = accountCredentials(env);
  if (!credentials) return 'unavailable';
  let teams: string[];
  try {
    teams = (await readAccountTeams(credentials, personId)).map((t) => t.id);
  } catch (error) {
    console.warn('[calendar-feed] teams_failed', { error: String(error) });
    return 'unavailable';
  }
  const index = indexFor(env, { kind: 'delegate', personId, teams });
  if (!index) return 'unavailable';
  try {
    const grant = await index.grant(planId, null);
    // A plan in the Trash serves no feed; a grant confined to one tab is a link's, never an owner's or a team's.
    return grant.trashed || grant.tabId !== null ? 'refused' : 'ok';
  } catch (error) {
    if (error instanceof IndexError && error.status < 500) return 'refused';
    console.warn('[calendar-feed] index_failed', { error: String(error) });
    return 'unavailable';
  }
}
