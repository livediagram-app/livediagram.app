import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livedesign/design';
import { ACTIVITY_LIST_MAX } from '@livedesign/api-schema';
import { __setOfflineBackend, offlinePutRecord } from './offline-store';
import {
  offlineActivityFromRecords,
  offlineReader,
  readOfflineActivity,
  type OfflineReader,
} from './offline-activity';
import { memBackend, testRecord, testTab } from './offline-test-utils';

// The Inbox's read of designs in This Browser (docs/specs/013-workspace/inbox.md §2.6): the server's rules, applied
// in the browser, with the reader owning every design.

afterEach(() => __setOfflineBackend(null));

const shape = (id: string, label: string, extra: Record<string, unknown> = {}): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    label,
    ...extra,
  }) as never;

const action = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  name: 'Book the venue',
  description: '',
  assignee: { userId: 'guest-1', name: 'Me' },
  assignerId: 'guest-1',
  assignerName: 'Me',
  status: 'open',
  createdAt: 100,
  updatedAt: 150,
  ...over,
});

async function reader(...ids: string[]): Promise<OfflineReader> {
  return offlineReader(ids);
}

describe('offlineActivityFromRecords', () => {
  it('lists an open action assigned to the reader, as one of their own designs', async () => {
    const rec = testRecord({
      name: 'Retro',
      tabs: [
        testTab('t1', { name: 'Board', elements: [shape('s1', 'Venue', { action: action() })] }),
      ],
    });
    const { actions } = offlineActivityFromRecords([rec], await reader('guest-1'));
    expect(actions).toEqual([
      expect.objectContaining({
        designId: 'd1',
        designName: 'Retro',
        via: 'own',
        teamId: null,
        shareCode: null,
        tabId: 't1',
        tabName: 'Board',
        elementId: 's1',
        elementLabel: 'Venue',
        id: 'a1',
        assignedToMe: true,
        createdByMe: true,
      }),
    ]);
  });

  it('matches the guest id beside the owner id, and skips actions that are not the reader’s or are closed', async () => {
    const rec = testRecord({
      tabs: [
        testTab('t1', {
          elements: [
            shape('mine', 'Mine', { action: action({ id: 'm' }) }),
            shape('theirs', 'Theirs', {
              action: action({ id: 't', assignee: { userId: 'u-other' }, assignerId: 'u-other' }),
            }),
            shape('handed', 'Handed', {
              action: action({ id: 'h', assignee: { userId: 'u-other', name: 'Ana' } }),
            }),
            shape('done', 'Done', { action: action({ id: 'd', status: 'done' }) }),
          ],
        }),
      ],
    });
    const { actions } = offlineActivityFromRecords([rec], await reader('user_me', 'guest-1'));
    expect(actions.map((a) => [a.id, a.assignedToMe, a.createdByMe])).toEqual([
      ['m', true, true],
      ['h', false, true],
    ]);
  });

  it('lists every unresolved thread as on the reader’s design, with whether they wrote or were mentioned', async () => {
    const c = (id: string, at: number, authorId?: string, mentions?: unknown[]) => ({
      id,
      text: `c-${id}`,
      createdAt: at,
      authorName: id,
      authorColor: '#111',
      ...(authorId ? { authorId } : {}),
      ...(mentions ? { mentions } : {}),
    });
    const rec = testRecord({
      tabs: [
        testTab('t1', {
          elements: [
            shape('a', 'A', {
              commentThread: { comments: [c('1', 5, 'guest-1')], resolved: false },
            }),
            shape('b', 'B', {
              commentThread: {
                comments: [c('2', 9, 'u-x', [{ userId: 'guest-1' }])],
                resolved: false,
              },
            }),
            shape('r', 'R', { commentThread: { comments: [c('3', 7)], resolved: true } }),
          ],
        }),
      ],
    });
    const { threads } = offlineActivityFromRecords([rec], await reader('guest-1'));
    expect(
      threads.map((t) => [t.elementId, t.youCommented, t.mentionsYou, t.onYourDesign]),
    ).toEqual([
      ['b', false, true, true],
      ['a', true, false, true],
    ]);
  });

  it('skips a design in the local Trash', async () => {
    const rec = testRecord({
      trashedAt: 5,
      tabs: [testTab('t1', { elements: [shape('s1', 'S', { action: action() })] })],
    });
    expect(offlineActivityFromRecords([rec], await reader('guest-1')).actions).toEqual([]);
  });

  it('caps each list like the server read, newest first', async () => {
    const elements = Array.from({ length: ACTIVITY_LIST_MAX + 5 }, (_, i) =>
      shape(`s${i}`, `S${i}`, { action: action({ id: `a${i}`, updatedAt: i }) }),
    );
    const rec = testRecord({ tabs: [testTab('t1', { elements })] });
    const { actions } = offlineActivityFromRecords([rec], await reader('guest-1'));
    expect(actions).toHaveLength(ACTIVITY_LIST_MAX);
    expect(actions[0]?.updatedAt).toBe(ACTIVITY_LIST_MAX + 4);
  });
});

describe('readOfflineActivity', () => {
  it('reads the browser’s records, ignoring blank ids', async () => {
    __setOfflineBackend(memBackend());
    await offlinePutRecord(
      testRecord({ tabs: [testTab('t1', { elements: [shape('s1', 'S', { action: action() })] })] }),
    );
    const { actions } = await readOfflineActivity(['guest-1', null]);
    expect(actions.map((a) => a.id)).toEqual(['a1']);
  });

  it('hands the main thread back between designs once a slice has run', async () => {
    __setOfflineBackend(memBackend());
    for (const id of ['d1', 'd2', 'd3']) await offlinePutRecord(testRecord({ id }));
    let clock = 0;
    const now = vi.spyOn(performance, 'now').mockImplementation(() => (clock += 10));
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    await readOfflineActivity(['guest-1']);
    expect(timeout.mock.calls.filter(([, ms]) => ms === 0)).toHaveLength(3);
    now.mockRestore();
    timeout.mockRestore();
  });

  it('reads nothing when the browser holds no designs in This Browser', async () => {
    __setOfflineBackend(memBackend());
    expect(await readOfflineActivity(['guest-1'])).toEqual({
      actions: [],
      threads: [],
    });
  });
});
