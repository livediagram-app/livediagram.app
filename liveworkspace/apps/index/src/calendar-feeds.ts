// Calendar feeds (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Calendar feeds"; blueprints/inbox.md):
// a person's private calendar feed of the open cards assigned to them in one app (liveplanner's My Work feed). The app
// makes the link and serves the `.ics`; the index keeps only the token's hash, beside the cards it lists, and answers
// who a token is (to the app's key) and which cards are the person's (to the app acting for them), fresh each time.

import {
  COLLAB_CARDS_TAB,
  type CalendarCard,
  type CalendarFeedRead,
  type CollabCard,
} from '@liveworkspace/index-client';
import { scopesOf } from './auth';
import type { PersonContext } from './context';
import type { Env } from './env';
import { badRequest, forbidden, json, noContent, notFound, readObject } from './http';
import type { App } from '@liveworkspace/index-client';

// The most cards one read answers: the app keeps the 500 nearest today of them.
export const CALENDAR_CARDS_MAX = 1000;

// A token's SHA-256, lowercase hex: the only form of it the index ever holds.
const TOKEN_HASH = /^[0-9a-f]{64}$/;

/** The open card actions assigned to the person in `app` with a Start or Due day, on live items they own or reach
 *  through one of their scopes: the Inbox's reach without its link clause, so a plan reached only through a share link
 *  never lists. One range of `collab_actions_assignee`. */
export function calendarCardsQuery(personId: string, scopes: readonly string[], app: App) {
  return {
    sql: `SELECT a.item_id, i.title AS item_title, a.element_id, a.card, a.updated_at
      FROM collab_actions a JOIN items i ON i.id = a.item_id
      WHERE a.assignee_id = ? AND a.status = 'open' AND a.app = ? AND a.tab_id = '${COLLAB_CARDS_TAB}'
        AND i.trashed_at IS NULL
        AND (json_extract(a.card, '$.start') IS NOT NULL OR json_extract(a.card, '$.due') IS NOT NULL)
        AND ((i.owner_id = ? AND i.team_id IS NULL) OR i.scope IN (SELECT value FROM json_each(?)))
      ORDER BY a.updated_at DESC LIMIT ?`,
    args: [personId, app, personId, JSON.stringify(scopes), CALENDAR_CARDS_MAX],
  };
}

type CardRow = {
  item_id: string;
  item_title: string;
  element_id: string;
  card: string | null;
  updated_at: number;
};

function cardOf(text: string | null): CollabCard | null {
  if (!text) return null;
  try {
    const card = JSON.parse(text) as CollabCard | null;
    return card && typeof card === 'object' ? card : null;
  } catch {
    return null;
  }
}

async function readCards(ctx: PersonContext, app: App): Promise<Response> {
  const q = calendarCardsQuery(ctx.person.id, scopesOf(ctx.person), app);
  const { results } = await ctx.env.INDEX_DB.prepare(q.sql)
    .bind(...q.args)
    .all<CardRow>();
  const cards: CalendarCard[] = [];
  for (const r of results ?? []) {
    const card = cardOf(r.card);
    if (!card) continue;
    cards.push({
      itemId: r.item_id,
      itemTitle: r.item_title,
      cardId: r.element_id,
      card,
      updatedAt: r.updated_at,
    });
  }
  return json({ cards });
}

/** `/calendar-feed` and `/calendar-feed/cards`: the person's own feed in the app acting for them, and its cards. */
export async function handleCalendarFeed(ctx: PersonContext): Promise<Response> {
  const { env, request, person, segments } = ctx;
  // Only an app acting for an account: it has checked the person is signed in, in person, and it alone serves the
  // feed. A person's own token, the Drive mirror and the export never reach a feed.
  const app = person.app;
  if (!app || person.kind !== 'account' || person.drive || person.export) {
    return forbidden('calendar_feed_app_only');
  }
  if (segments.length === 2 && segments[1] === 'cards' && request.method === 'GET') {
    return readCards(ctx, app);
  }
  if (segments.length !== 1) return notFound();
  const db = env.INDEX_DB;
  if (request.method === 'GET') {
    const row = await db
      .prepare('SELECT created_at FROM calendar_feeds WHERE person_id = ? AND app = ?')
      .bind(person.id, app)
      .first<{ created_at: number }>();
    const body: CalendarFeedRead = { feed: row ? { createdAt: row.created_at } : null };
    return json(body);
  }
  if (request.method === 'PUT') {
    const body = await readObject(request);
    const tokenHash = body?.tokenHash;
    if (typeof tokenHash !== 'string' || !TOKEN_HASH.test(tokenHash)) {
      return badRequest('calendar_feed_invalid');
    }
    const createdAt = Date.now();
    // Over an existing row this is Reset Link: the old hash is gone in the same statement.
    await db
      .prepare(
        `INSERT INTO calendar_feeds (person_id, app, token_hash, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (person_id, app) DO UPDATE SET token_hash = excluded.token_hash,
           created_at = excluded.created_at`,
      )
      .bind(person.id, app, tokenHash, createdAt)
      .run();
    return json({ feed: { createdAt } });
  }
  if (request.method === 'DELETE') {
    await db
      .prepare('DELETE FROM calendar_feeds WHERE person_id = ? AND app = ?')
      .bind(person.id, app)
      .run();
    return noContent();
  }
  return notFound();
}

/** `GET /app/calendar-feeds/:tokenHash`: the person whose feed in this app has this hash, or 404. */
export async function calendarFeedByToken(
  env: Env,
  app: App,
  tokenHash: string,
): Promise<Response> {
  if (!TOKEN_HASH.test(tokenHash)) return notFound();
  const row = await env.INDEX_DB.prepare(
    'SELECT person_id FROM calendar_feeds WHERE token_hash = ? AND app = ?',
  )
    .bind(tokenHash, app)
    .first<{ person_id: string }>();
  return row ? json({ personId: row.person_id }) : notFound();
}
