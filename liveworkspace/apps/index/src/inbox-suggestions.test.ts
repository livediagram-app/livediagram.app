// Suggested edits in the Inbox (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an item pushes" and
// "Inbox", Work Tracker 1362): the collab push replaces a tab's suggestions as it does its threads, and the Inbox lists
// those waiting on the reader's pages, on live items they still reach, newest first, in its one batch.
import {
  COLLAB_MAX_SUGGESTIONS,
  COLLAB_SUGGESTION_TEXT_MAX,
  type CollabSuggestionInput,
  type InboxResponse,
} from '@liveworkspace/index-client';
import { describe, expect, it, vi } from 'vitest';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const asApp = (path: string, payload: unknown) =>
  call(path, {
    method: 'PUT',
    auth: 'lp-key',
    headers: { 'X-Index-App': 'liveplanner' },
    body: payload,
  });

const inbox = async (auth: string, query = '') =>
  body<InboxResponse>(await call(`/inbox${query}`, { auth }));

const suggestion = (patch: Partial<CollabSuggestionInput> = {}): CollabSuggestionInput => ({
  id: 'sg-1',
  ownerId: null,
  agent: 'Claude',
  reason: 'The rota moved.',
  kind: 'replace',
  before: 'Mondays',
  after: 'Tuesdays',
  createdAt: 10,
  ...patch,
});

const push = (itemId: string, tabId: string, suggestions?: CollabSuggestionInput[]) =>
  asApp(`/app/items/${itemId}/collab/${tabId}`, {
    tabName: `Page ${tabId}`,
    threads: [],
    actions: [],
    ...(suggestions ? { suggestions } : {}),
  });

describe('Inbox suggested edits', () => {
  it('list a suggestion on my page, with its place and change, newest first', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth, { title: 'Handbook' });
    expect(
      (
        await push(item.id, 'p1', [
          suggestion({ id: 'old', createdAt: 5 }),
          suggestion({ id: 'new', kind: 'append', before: '', after: '## On call', createdAt: 20 }),
        ])
      ).status,
    ).toBe(204);
    const read = await inbox(ada.auth);
    expect(read.suggestions!.map((s) => s.suggestionId)).toEqual(['new', 'old']);
    expect(read.suggestions![0]).toEqual({
      app: 'liveplanner',
      itemId: item.id,
      itemTitle: 'Handbook',
      itemTeamId: null,
      tabId: 'p1',
      tabName: 'Page p1',
      suggestionId: 'new',
      agent: 'Claude',
      reason: 'The rota moved.',
      kind: 'append',
      before: '',
      after: '## On call',
      createdAt: 20,
    });
  });

  it('wait on the page’s owner by name, or on the item’s owner when it names no one', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const cat = await person('user_c');
    const item = await makeItem(ada.auth, { title: 'Team wiki', teamId: 'team1' });
    await push(item.id, 'p1', [
      suggestion({ id: 'bobs', ownerId: 'user_b' }),
      suggestion({ id: 'nobodys', ownerId: null }),
      suggestion({ id: 'cats', ownerId: 'user_c' }),
    ]);
    expect((await inbox(ada.auth)).suggestions!.map((s) => s.suggestionId)).toEqual(['nobodys']);
    // Bob owns his page on a team item: he reaches it through the team.
    expect((await inbox(bob.auth)).suggestions!.map((s) => s.suggestionId)).toEqual(['bobs']);
    // Cat is named but reaches nothing: no row.
    expect((await inbox(cat.auth)).suggestions).toEqual([]);
  });

  it('replace the tab’s suggestions with each push; absent is none', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await push(item.id, 'p1', [suggestion({ id: 'a' }), suggestion({ id: 'b' })]);
    await push(item.id, 'p2', [suggestion({ id: 'other' })]);
    await push(item.id, 'p1', [suggestion({ id: 'b', after: 'Wednesdays' })]);
    let read = (await inbox(ada.auth)).suggestions!;
    expect(read.map((s) => [s.tabId, s.suggestionId, s.after]).sort()).toEqual([
      ['p1', 'b', 'Wednesdays'],
      ['p2', 'other', 'Tuesdays'],
    ]);
    // A push without the field (an app with no suggestions, or none left) clears the tab's.
    await push(item.id, 'p1');
    read = (await inbox(ada.auth)).suggestions!;
    expect(read.map((s) => s.suggestionId)).toEqual(['other']);
    expect(h.db.sql.prepare('SELECT count(*) AS n FROM collab_suggestions').get()).toEqual({
      n: 1,
    });
  });

  it('cut long texts, and refuse a malformed suggestion or too many', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await push(item.id, 'p1', [
      suggestion({ before: 'b'.repeat(5_000), after: 'a'.repeat(5_000), reason: 'r'.repeat(900) }),
    ]);
    const [s] = (await inbox(ada.auth)).suggestions!;
    expect(s!.before).toHaveLength(COLLAB_SUGGESTION_TEXT_MAX);
    expect(s!.after).toHaveLength(COLLAB_SUGGESTION_TEXT_MAX);
    expect(s!.reason).toHaveLength(500);
    for (const bad of [
      [suggestion({ kind: 'rewrite' as never })],
      [suggestion({ id: '' })],
      [suggestion({ createdAt: -1 })],
      Array.from({ length: COLLAB_MAX_SUGGESTIONS + 1 }, (_, i) => suggestion({ id: `s${i}` })),
    ]) {
      expect(await body(await push(item.id, 'p1', bad))).toEqual({ error: 'invalid_collab' });
    }
  });

  it('leave with a trashed item, and filter by app', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await push(item.id, 'p1', [suggestion()]);
    expect((await inbox(ada.auth, '?app=livediagram')).suggestions).toEqual([]);
    expect((await inbox(ada.auth, '?app=liveplanner')).suggestions).toHaveLength(1);
    expect((await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth })).status).toBe(
      204,
    );
    expect((await inbox(ada.auth)).suggestions).toEqual([]);
  });

  it('make no event', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const before = h.db.sql.prepare('SELECT count(*) AS n FROM events').get();
    await push(item.id, 'p1', [suggestion()]);
    expect(h.db.sql.prepare('SELECT count(*) AS n FROM events').get()).toEqual(before);
  });

  it('read in the Inbox’s one batch', async () => {
    const ada = await person('user_a');
    const spy = vi.spyOn(h.db.env.INDEX_DB, 'batch');
    await inbox(ada.auth);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toHaveLength(8);
  });
});
