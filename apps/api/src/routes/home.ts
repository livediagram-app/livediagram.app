// /api/home — Explorer Home's data (docs/specs/013-workspace/explorer-home.md; blueprint
// docs/specs/013-workspace/blueprints/explorer-home.md).
//
// GET /api/home  -> HomeResponse: Jump back in and What happened
//
// Read-only. Hybrid identity like the rest of the api: guests get their own Home, keyed to their
// guest id. Opens are recorded on the tab read, not here (routes/document-subresource-routes.ts).

import {
  HOME_WHAT_HAPPENED_ACTION_MAX,
  HOME_WHAT_HAPPENED_DAYS,
  type HomeRejection,
  type HomeResponse,
} from '@livediagram/api-schema';
import { readJumpBackIn, readMe, readWhatHappenedRows } from '../db/home';
import { getScopeState, markScopeSeen } from '../db/timeline';
import { isNewVisit } from '../timeline/seen';
import { groupWhatHappened } from '../home/what-happened';
import { parseTimeZone } from '../home/local-day';
import { json, missingAuth, notFound, rateLimited } from '../responses';
import { userScope } from '../timeline';
import type { RouteContext } from './context';

const DAY_MS = 24 * 60 * 60 * 1000;

function rejected(reason: HomeRejection): Response {
  console.warn(`home: rejected reason=${reason}`);
  return json({ error: reason }, { status: 400 });
}

export async function handleHome(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments, resolveOwner } = ctx;
  if (segments[1] !== 'home') return notFound();
  const personId = resolveOwner();
  if (!personId) return missingAuth();
  if (request.method !== 'GET' || segments.length !== 2) return notFound();

  if (env.HOME_RATE_LIMITER && !(await env.HOME_RATE_LIMITER.limit({ key: personId })).success) {
    console.warn('home: rate-limited');
    return rateLimited();
  }

  const timeZone = parseTimeZone(url.searchParams.get('tz'));
  if (timeZone === null) return rejected('tz_invalid');
  const now = Date.now();

  const scope = userScope(personId);
  const [scopeState, set, rows, me] = await Promise.all([
    getScopeState(env, scope),
    readJumpBackIn(env, personId, now),
    readWhatHappenedRows(env, personId, now, {
      since: now - HOME_WHAT_HAPPENED_DAYS * DAY_MS,
      limit: HOME_WHAT_HAPPENED_ACTION_MAX,
    }),
    readMe(env, personId),
  ]);
  if (rows.length >= HOME_WHAT_HAPPENED_ACTION_MAX) {
    console.warn(`home: what-happened-capped max=${HOME_WHAT_HAPPENED_ACTION_MAX}`);
  }
  const whatHappened = groupWhatHappened(rows, timeZone, me);
  // Most used, then recent: the view merges this browser's local documents in by the same rule.
  const jumpBackIn = [...set.mostUsed, ...set.recent];

  // Viewing Home is having looked (docs/specs/013-workspace/explorer-home.md "Unread"): the
  // Timeline's unread mark moves by the Timeline's own visit rule, after the read has captured it.
  const lastSeenAt = scopeState?.lastSeenAt ?? null;
  if (isNewVisit(lastSeenAt, now)) {
    ctx.waitUntil?.(
      markScopeSeen(env, scope)
        .then(() => console.info('home: seen-marked'))
        .catch((err) => console.error('home: seen-mark-failed', err)),
    );
  }

  console.info(
    `home: read jump=${jumpBackIn.length} used=${set.mostUsed.length} recent=${set.recent.length} groups=${whatHappened.length} actions=${rows.length}`,
  );
  const body: HomeResponse = { jumpBackIn, whatHappened, lastSeenAt };
  return json(body);
}
