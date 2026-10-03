// /api/home — Explorer Home's data (docs/specs/013-workspace/explorer-home.md; blueprint
// docs/specs/013-workspace/blueprints/explorer-home.md).
//
// GET /api/home           -> HomeResponse: Jump back in, the Timeline's first page, What happened
// GET /api/home/timeline  -> HomeTimelinePage: the next pages of the Timeline
//
// Read-only. Hybrid identity like the rest of the api: guests get their own Home, keyed to their
// guest id. Opens are recorded on the tab read, not here (routes/document-subresource-routes.ts).

import {
  HOME_JUMP_BACK_IN_MAX,
  HOME_TIMELINE_PAGE_MAX,
  HOME_TIMELINE_PAGE_SIZE,
  HOME_WHAT_HAPPENED_ACTION_MAX,
  HOME_WHAT_HAPPENED_DAYS,
  type HomeRejection,
  type HomeResponse,
} from '@livediagram/api-schema';
import {
  parseHomeCursor,
  readHomeTimeline,
  readJumpBackIn,
  readMe,
  readWhatHappenedRows,
  type HomeCursor,
} from '../db/home';
import { getScopeState, markScopeSeen } from '../db/timeline';
import { seedFrecency } from '../home/seed-frecency';
import { isNewVisit } from '../timeline/seen';
import { groupWhatHappened } from '../home/what-happened';
import { parseTimeZone } from '../home/local-day';
import { json, missingAuth, notFound, rateLimited } from '../responses';
import { backfillUserScope, userScope } from '../timeline';
import type { RouteContext } from './context';

const DAY_MS = 24 * 60 * 60 * 1000;

function rejected(reason: HomeRejection): Response {
  console.warn(`home: rejected reason=${reason}`);
  return json({ error: reason }, { status: 400 });
}

/** The page size asked for: the default when absent, null when it is not a whole number in range. */
function parseLimit(raw: string | null): number | null {
  if (raw === null) return HOME_TIMELINE_PAGE_SIZE;
  if (!/^\d+$/.test(raw)) return null;
  const limit = Number(raw);
  return limit >= 1 && limit <= HOME_TIMELINE_PAGE_MAX ? limit : null;
}

export async function handleHome(ctx: RouteContext): Promise<Response> {
  const { request, env, url, segments, resolveOwner } = ctx;
  if (segments[1] !== 'home') return notFound();
  const personId = resolveOwner();
  if (!personId) return missingAuth();
  const isHome = segments.length === 2;
  const isTimeline = segments.length === 3 && segments[2] === 'timeline';
  if (request.method !== 'GET' || (!isHome && !isTimeline)) return notFound();

  if (env.HOME_RATE_LIMITER && !(await env.HOME_RATE_LIMITER.limit({ key: personId })).success) {
    console.warn('home: rate-limited');
    return rateLimited();
  }

  const limit = parseLimit(url.searchParams.get('limit'));
  if (limit === null) return rejected('limit_invalid');
  const rawCursor = url.searchParams.get('cursor');
  let cursor: HomeCursor | null = null;
  if (rawCursor !== null) {
    cursor = parseHomeCursor(rawCursor);
    if (cursor === null) return rejected('cursor_invalid');
  }
  const now = Date.now();

  if (isTimeline) {
    const page = await readHomeTimeline(env, personId, now, { limit, cursor });
    console.info(
      `home: timeline-page items=${page.items.length} more=${page.nextCursor ? 'yes' : 'no'}`,
    );
    return json(page);
  }

  const timeZone = parseTimeZone(url.searchParams.get('tz'));
  if (timeZone === null) return rejected('tz_invalid');

  const scope = userScope(personId);
  const scopeState = await getScopeState(env, scope);
  // Jump back in is seeded once from the person's real edit days, inline so their first Home is
  // not empty. A failure leaves the stamp unset (the next read tries again) and the read goes on.
  if (!scopeState?.frecencySeededAt) {
    await seedFrecency(env, personId, now).catch((err) =>
      console.error('home: frecency-seed-failed', err),
    );
  }

  const [jumpBackIn, timeline, rows, me] = await Promise.all([
    readJumpBackIn(env, personId, now, HOME_JUMP_BACK_IN_MAX),
    readHomeTimeline(env, personId, now, { limit, cursor }),
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

  // Home's Timeline reads the same events the Timeline backfill seeds (created, updated), so a
  // person who has never opened the Timeline gets their history here too. Off the response path.
  if (!scopeState?.backfilledAt) {
    console.info('home: backfill-dispatched');
    ctx.waitUntil?.(
      backfillUserScope(env, personId).catch((err) => console.error('home: backfill-failed', err)),
    );
  }

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
    `home: read jump=${jumpBackIn.length} timeline=${timeline.items.length} groups=${whatHappened.length} actions=${rows.length}`,
  );
  const body: HomeResponse = { jumpBackIn, timeline, whatHappened, lastSeenAt };
  return json(body);
}
