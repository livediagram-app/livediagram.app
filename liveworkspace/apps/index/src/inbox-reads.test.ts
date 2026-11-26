// The Inbox's AI comments and read state (liveworkspace/docs/specs/004-index/inbox-reading.md): a thread only agents
// wrote in is listed in nobody's Inbox, one an agent asks in says so, and read, unread and read all are kept per
// person, answered with the list.
import {
  INBOX_READ_BATCH_MAX,
  INBOX_READS_MAX,
  threadKey,
  type CollabThreadInput,
  type InboxResponse,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { parseReadChange } from './inbox-reads';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const asApp = (path: string, payload: unknown) =>
  call(path, {
    method: 'PUT',
    auth: 'lp-key',
    headers: { 'X-Index-App': 'liveplanner' },
    body: payload,
  });

const inbox = async (auth: string) => body<InboxResponse>(await call('/inbox', { auth }));
const mark = (auth: string, change: unknown) =>
  call('/inbox/read', { method: 'PUT', auth, body: change });

const thread = (patch: Partial<CollabThreadInput> = {}): CollabThreadInput => ({
  elementId: 'el-1',
  elementLabel: 'Card',
  resolved: false,
  commentCount: 1,
  participantIds: [],
  mentionedIds: [],
  latestText: 'Looks good',
  latestAuthorName: 'Ada',
  firstAt: 1,
  latestAt: 2,
  ...patch,
});

async function adaWithThreads(threads: CollabThreadInput[]) {
  const ada = await person('user_a');
  const item = await makeItem(ada.auth, { title: 'Plan', app: 'liveplanner' });
  const pushed = await asApp(`/app/items/${item.id}/collab/t1`, { threads, actions: [] });
  expect(pushed.status).toBe(204);
  return { ada, item };
}

describe('AI comments in the Inbox', () => {
  it('lists no thread only agents wrote in, and marks an agent’s latest and its ask', async () => {
    const { ada } = await adaWithThreads([
      thread({ elementId: 'quiet', agentIds: ['user_a'], latestAgent: 'Claude', aiState: 'quiet' }),
      thread({ elementId: 'asks', agentIds: ['user_a'], latestAgent: 'Claude', aiState: 'ask' }),
      thread({ elementId: 'people', participantIds: ['user_b'], latestAgent: 'Cursor' }),
      thread({ elementId: 'plain', participantIds: ['user_b'] }),
    ]);
    const rows = Object.fromEntries((await inbox(ada.auth)).threads.map((t) => [t.elementId, t]));
    expect(Object.keys(rows).sort()).toEqual(['asks', 'people', 'plain']);
    expect(rows.asks).toMatchObject({ latestAgent: 'Claude', asks: true });
    expect(rows.people).toMatchObject({ latestAgent: 'Cursor', asks: false });
    expect(rows.plain).toMatchObject({ latestAgent: null, asks: false });
  });

  it('cuts a long name and drops an unknown state, never refusing the push', async () => {
    const { ada } = await adaWithThreads([
      thread({
        participantIds: ['user_b'],
        latestAgent: 'x'.repeat(300),
        aiState: 'loud' as never,
      }),
    ]);
    const [row] = (await inbox(ada.auth)).threads;
    expect(row!.latestAgent).toHaveLength(80);
    expect(row!.asks).toBe(false);
  });
});

describe('Inbox read state', () => {
  it('answers every row unread until it is read, unread again when it changes', async () => {
    const { ada, item } = await adaWithThreads([thread({ participantIds: ['user_b'] })]);
    const first = await inbox(ada.auth);
    const key = threadKey(first.threads[0]!);
    expect(first.read).toEqual({ before: 0, at: {} });
    expect((await mark(ada.auth, { read: [{ key, at: 2 }] })).status).toBe(204);
    expect((await inbox(ada.auth)).read).toEqual({ before: 0, at: { [key]: 2 } });
    // An older read never moves it back.
    await mark(ada.auth, { read: [{ key, at: 1 }] });
    expect((await inbox(ada.auth)).read!.at[key]).toBe(2);
    // Marked unread: 0, until read again.
    await mark(ada.auth, { unread: [key] });
    expect((await inbox(ada.auth)).read!.at[key]).toBe(0);
    await mark(ada.auth, { read: [{ key, at: 2 }] });
    expect((await inbox(ada.auth)).read!.at[key]).toBe(2);
    // A key not listed is left out of the answer.
    await mark(ada.auth, { read: [{ key: 't:liveplanner:gone:t1:x', at: 9 }] });
    expect(Object.keys((await inbox(ada.auth)).read!.at)).toEqual([key]);
    expect(item.id).toBeTruthy();
  });

  it('reads all: the mark moves to now and every entry goes', async () => {
    const { ada } = await adaWithThreads([thread({ participantIds: ['user_b'] })]);
    const key = threadKey((await inbox(ada.auth)).threads[0]!);
    await mark(ada.auth, { unread: [key] });
    const before = Date.now();
    await mark(ada.auth, { all: true });
    const read = (await inbox(ada.auth)).read!;
    expect(read.at).toEqual({});
    expect(read.before).toBeGreaterThanOrEqual(before);
  });

  it('is an account’s alone, refusing a guest and a malformed change', async () => {
    const guest = await person('guest_1', { guest: true });
    expect((await mark(guest.auth, { all: true })).status).toBe(403);
    expect((await inbox(guest.auth)).read).toBeUndefined();
    const ada = await person('user_a');
    for (const bad of [
      {},
      { all: false },
      { read: [{ key: '', at: 1 }] },
      { read: [{ key: 'k', at: -1 }] },
      { unread: ['x'.repeat(301)] },
      {
        read: Array.from({ length: INBOX_READ_BATCH_MAX + 1 }, (_, i) => ({ key: `k${i}`, at: 1 })),
      },
    ]) {
      const res = await mark(ada.auth, bad);
      expect(res.status, JSON.stringify(bad).slice(0, 60)).toBe(400);
    }
    expect((await call('/inbox/read', { auth: ada.auth })).status).toBe(404);
    expect((await call('/inbox/other', { auth: ada.auth })).status).toBe(404);
  });

  it('keeps the newest entries per person', async () => {
    const ada = await person('user_a');
    for (let i = 0; i < Math.ceil((INBOX_READS_MAX + 10) / INBOX_READ_BATCH_MAX); i++) {
      const read = Array.from({ length: INBOX_READ_BATCH_MAX }, (_, j) => ({
        key: `k${i}-${j}`,
        at: 1,
      }));
      expect((await mark(ada.auth, { read })).status).toBe(204);
    }
    const kept = h.db.sql
      .prepare('SELECT COUNT(*) AS n FROM inbox_reads WHERE person_id = ?')
      .get('user_a') as { n: number };
    expect(kept.n).toBe(INBOX_READS_MAX);
  });
});

describe('parseReadChange', () => {
  it('takes a change and refuses one that asks nothing', () => {
    expect(parseReadChange({ read: [{ key: 'a', at: 1 }], unread: ['b'] })).toEqual({
      read: [{ key: 'a', at: 1 }],
      unread: ['b'],
      all: false,
    });
    expect(parseReadChange(null)).toBeNull();
    expect(parseReadChange({ read: 'x' })).toBeNull();
    expect(parseReadChange({ read: [null] })).toBeNull();
  });
});
