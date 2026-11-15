// Calendar feeds (one-explorer-contracts.md "Calendar feeds"): the person's own feed through their app only (make,
// reset, read, turn off), a token's person for the app's key, and the cards read: open, assigned, dated, on items the
// person owns or reaches through a team, never through a link.
import {
  COLLAB_CARDS_TAB,
  type CalendarCard,
  type CollabActionInput,
  type CollabCard,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const HASH = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);

const asLiveplanner = (personId: string, teams = '') => ({
  auth: 'lp-key',
  headers: { 'X-Index-App': 'liveplanner', 'X-Index-Person': personId, 'X-Index-Teams': teams },
});

const feedCall = (personId: string, method = 'GET', payload?: unknown, path = '/calendar-feed') =>
  call(path, { ...asLiveplanner(personId), method, body: payload });

const byToken = (hash: string, app = 'liveplanner', key = 'lp-key') =>
  call(`/app/calendar-feeds/${hash}`, { auth: key, headers: { 'X-Index-App': app } });

const card = (patch: Partial<CollabCard> = {}): CollabCard => ({
  key: 7,
  type: 'task',
  typeLabel: 'Task',
  title: 'Ship it',
  board: { tabId: 'tab-1', elementId: 'board-1', title: 'Sprint', tabName: 'Board' },
  due: '2026-11-20',
  ...patch,
});

const action = (patch: Partial<CollabActionInput> = {}): CollabActionInput => ({
  elementId: 'card-1',
  actionId: 'card-1',
  elementLabel: 'Ship it',
  name: 'Ship it',
  status: 'open',
  assigneeId: 'user_b',
  assignerId: 'user_a',
  teamId: null,
  card: card(),
  createdAt: 1,
  updatedAt: 2,
  ...patch,
});

const pushCards = (itemId: string, actions: CollabActionInput[]) =>
  call(`/app/items/${itemId}/collab/${COLLAB_CARDS_TAB}`, {
    method: 'PUT',
    auth: 'lp-key',
    headers: { 'X-Index-App': 'liveplanner' },
    body: { threads: [], actions },
  });

const cardsOf = async (personId: string, teams = '') =>
  (
    await body<{ cards: CalendarCard[] }>(
      await call('/calendar-feed/cards', asLiveplanner(personId, teams)),
    )
  ).cards;

describe('a person’s calendar feed', () => {
  it('is made, read, reset and turned off through their app, and names its person to the app’s key', async () => {
    expect(await body(await feedCall('user_b'))).toEqual({ feed: null });
    const made = await body<{ feed: { createdAt: number } }>(
      await feedCall('user_b', 'PUT', { tokenHash: HASH }),
    );
    expect(made.feed.createdAt).toBeGreaterThan(0);
    expect(await body(await feedCall('user_b'))).toEqual(made);
    expect(await body(await byToken(HASH))).toEqual({ personId: 'user_b' });

    // Reset Link: the old hash answers nothing at once.
    await feedCall('user_b', 'PUT', { tokenHash: OTHER });
    expect((await byToken(HASH)).status).toBe(404);
    expect(await body(await byToken(OTHER))).toEqual({ personId: 'user_b' });
    // Another app's key never reads liveplanner's feed.
    expect((await byToken(OTHER, 'livediagram', 'ld-key')).status).toBe(404);

    expect((await feedCall('user_b', 'DELETE')).status).toBe(204);
    expect((await feedCall('user_b', 'DELETE')).status).toBe(204);
    expect(await body(await feedCall('user_b'))).toEqual({ feed: null });
    expect((await byToken(OTHER)).status).toBe(404);
  });

  it('refuses a malformed hash, other methods and paths, and any caller but an app for an account', async () => {
    expect((await feedCall('user_b', 'PUT', { tokenHash: 'short' })).status).toBe(400);
    expect((await feedCall('user_b', 'PUT', {})).status).toBe(400);
    expect((await feedCall('user_b', 'POST')).status).toBe(404);
    expect((await feedCall('user_b', 'GET', undefined, '/calendar-feed/other')).status).toBe(404);
    expect((await byToken('not-a-hash')).status).toBe(404);
    const own = await person('user_b');
    const refused = await call('/calendar-feed', { auth: own.auth });
    expect(refused.status).toBe(403);
    expect(await body(refused)).toEqual({ error: 'calendar_feed_app_only' });
    expect((await call('/calendar-feed/cards', { auth: own.auth })).status).toBe(403);
  });

  it('is dropped with the person when their account closes', async () => {
    await feedCall('user_b', 'PUT', { tokenHash: HASH });
    const purged = await call('/internal/purge-person', {
      method: 'POST',
      auth: 'merge-key',
      body: { personId: 'user_b', teamIds: [] },
    });
    expect(purged.status).toBe(200);
    expect((await byToken(HASH)).status).toBe(404);
  });
});

describe('a calendar feed’s cards', () => {
  it('lists the open, dated cards assigned to the person on items they own or reach through a team', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const team = await makeItem(ada.auth, { title: 'Team plan', teamId: 'team1' });
    const own = await makeItem((await person('user_b')).auth, { title: 'My plan' });
    await pushCards(team.id, [
      action(),
      action({
        elementId: 'c-start',
        actionId: 'c-start',
        card: card({ due: undefined, start: '2026-11-01' }),
      }),
      action({ elementId: 'c-undated', actionId: 'c-undated', card: card({ due: undefined }) }),
      action({ elementId: 'c-other', actionId: 'c-other', assigneeId: 'user_c' }),
      action({ elementId: 'c-done', actionId: 'c-done', status: 'done' }),
      action({ elementId: 'c-bad', actionId: 'c-bad', card: card({ due: 'soon' }) }),
    ]);
    await pushCards(own.id, [action({ elementId: 'c-own', actionId: 'c-own', updatedAt: 9 })]);

    const cards = await cardsOf('user_b', 'team1');
    expect(cards.map((c) => c.cardId)).toEqual(['c-own', 'card-1', 'c-start']);
    expect(cards[1]).toEqual({
      itemId: team.id,
      itemTitle: 'Team plan',
      cardId: 'card-1',
      card: card(),
      updatedAt: 2,
    });
    expect(cards[2]!.card.start).toBe('2026-11-01');
    // Out of the team, its plan's cards leave the feed at once.
    expect((await cardsOf('user_b')).map((c) => c.cardId)).toEqual(['c-own']);
  });

  it('leaves out a plan in the Trash and one reached only through a share link', async () => {
    const ada = await person('user_a');
    const linked = await makeItem(ada.auth, { title: 'Shared plan' });
    const trashed = await makeItem((await person('user_b')).auth, { title: 'Old plan' });
    await pushCards(linked.id, [action()]);
    await pushCards(trashed.id, [action({ elementId: 'c-old', actionId: 'c-old' })]);
    const db = h.db.env.INDEX_DB;
    await db
      .prepare(
        `INSERT INTO share_links (code, item_id, level, tab_id, expiry, expires_at, created_at)
         VALUES ('ABCDEFGHJKMNPQ', ?, 'edit', NULL, 'never', NULL, 1)`,
      )
      .bind(linked.id)
      .run();
    await db
      .prepare(
        `INSERT INTO shared_with (person_id, item_id, share_code, last_seen) VALUES ('user_b', ?, 'ABCDEFGHJKMNPQ', 1)`,
      )
      .bind(linked.id)
      .run();
    await db.prepare('UPDATE items SET trashed_at = 5 WHERE id = ?').bind(trashed.id).run();
    expect(await cardsOf('user_b')).toEqual([]);
  });
});
