// The My Work feed's link (docs/specs/026-plan/calendar-feed.md "The My Work feed"; blueprint calendar-feed.md
// "Part 3"): `GET /api/calendar/my-work/lpf_<token>.ics`, reached from calendar-feed-route.ts before identity. The
// token is the whole proof. In order: the method (405) and the feed's own rate (429); the token's person from the
// index by its hash (404); their teams from accounts now; their open, dated cards from the index as that person now,
// on plans they own or reach through a team (404 when refused, 503 when accounts or the index cannot say); then the
// calendar, as a plan feed answers. Nothing cached, no plan room woken, the token never logged.

import { isAccountId, readAccountTeams } from '@liveworkspace/auth-client';
import { IndexError, type CalendarCard } from '@liveworkspace/index-client';
import { accountCredentials } from '../auth/accounts';
import { answerFeed, feedGate, refuseFeed } from '../calendar/feed-answer';
import { feedTokenHash } from '../calendar/feed-token';
import { myWorkEventsOf } from '../calendar/my-work-events';
import { appBaseUrl } from '../email/client';
import { indexAppClient, indexFor } from '../index-service';
import type { Env } from '../types';

// The link's first part after /api/calendar/ that names the My Work feed rather than a plan.
export const MY_WORK_FEED_SEGMENT = 'my-work';

/** The path of a person's My Work feed link, the one time its token leaves the api. */
export const myWorkFeedPath = (token: string) =>
  `/api/calendar/${MY_WORK_FEED_SEGMENT}/${token}.ics`;

// The token's person, from the index: `personId` null for none, null itself when the index cannot be asked.
async function personOf(env: Env, tokenHash: string): Promise<{ personId: string | null } | null> {
  const app = indexAppClient(env);
  if (!app) return null;
  try {
    return { personId: await app.calendarFeedByToken(tokenHash) };
  } catch (error) {
    console.warn('[calendar-feed] index_failed', { error: String(error) });
    return null;
  }
}

// The person's cards, asked fresh as them: 'refused' when they may reach none, 'unavailable' when nobody could say.
async function cardsOf(
  env: Env,
  personId: string,
): Promise<CalendarCard[] | 'refused' | 'unavailable'> {
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
    return await index.calendarCards();
  } catch (error) {
    if (error instanceof IndexError && error.status < 500) return 'refused';
    console.warn('[calendar-feed] index_failed', { error: String(error) });
    return 'unavailable';
  }
}

/** The My Work feed for `token` (its shape already checked), or the refusal. */
export async function handleMyWorkFeed(
  request: Request,
  env: Env,
  token: string,
  now: number = Date.now(),
): Promise<Response> {
  const tokenHash = await feedTokenHash(token);
  const gate = await feedGate(request, env.WRITE_RATE_LIMITER, tokenHash);
  if (gate) return gate;
  const found = await personOf(env, tokenHash);
  if (!found) return refuseFeed('unavailable');
  const { personId } = found;
  if (personId === null) return refuseFeed('unknown_token');
  // An account only: the index never acts for a guest.
  if (!isAccountId(personId)) return refuseFeed('no_access');
  const cards = await cardsOf(env, personId);
  if (cards === 'unavailable') return refuseFeed('unavailable');
  if (cards === 'refused') return refuseFeed('no_access');
  return answerFeed(request, myWorkEventsOf(cards, appBaseUrl(env), now), 'my-work.ics');
}
