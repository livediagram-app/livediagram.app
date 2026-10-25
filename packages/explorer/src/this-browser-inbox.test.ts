// This Browser in the Inbox (this-browser-inbox.ts): the app's snapshot of its offline items' Inbox rows, for the
// Explorer page on its address. Listed only to the person it names, bounded, heard as it changes, dropped with the
// last offline item, and kept fresh by the app's debounced keeper.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InboxAction, InboxThread } from '@liveworkspace/index-client';
import {
  dropInboxSnapshot,
  INBOX_SNAPSHOT_MAX,
  inboxSnapshotKeeper,
  inboxSnapshotKey,
  inboxSnapshotRows,
  readInboxSnapshot,
  subscribeInboxSnapshot,
  writeInboxSnapshot,
} from './this-browser';
import type { InboxLocalRows } from './types';

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

const action = (n: number, over: Partial<InboxAction> = {}): InboxAction => ({
  app: 'liveplanner',
  itemId: `p${n}`,
  itemTitle: `Plan ${n}`,
  itemTeamId: null,
  tabId: '~cards',
  tabName: '',
  elementId: `c${n}`,
  actionId: `card:c${n}`,
  elementLabel: `Card ${n}`,
  name: `Card ${n}`,
  description: '',
  status: 'open',
  assigneeId: 'user_me',
  assigneeName: null,
  assignerId: 'user_me',
  assignerName: null,
  teamId: null,
  card: null,
  createdAt: n,
  updatedAt: n,
  ...over,
});

const thread = (n: number): InboxThread => ({
  app: 'liveplanner',
  itemId: `p${n}`,
  itemTitle: `Plan ${n}`,
  itemTeamId: null,
  tabId: 't1',
  tabName: 'Plan',
  elementId: `e${n}`,
  elementLabel: `Shape ${n}`,
  card: null,
  resolved: false,
  commentCount: 1,
  latestText: 'Hi',
  latestAuthorName: 'Me',
  latestAuthorColor: '#000',
  mentionsYou: false,
  youCommented: true,
  onYourItem: true,
  firstAt: n,
  latestAt: n,
});

const rows = (actions: InboxAction[], threads: InboxThread[] = []): InboxLocalRows => ({
  actions,
  threads,
});

describe("the Inbox's This Browser snapshot", () => {
  it('is read back as written, under the shared key', () => {
    writeInboxSnapshot(
      'liveplanner',
      ['user_me', 'guest_1'],
      rows([action(1)], [thread(2)]),
      localStorage,
      50,
    );
    expect(localStorage.getItem('liveworkspace:this-browser-inbox:liveplanner')).not.toBeNull();
    expect(readInboxSnapshot('liveplanner')).toEqual({
      ownerIds: ['user_me', 'guest_1'],
      rows: rows([action(1)], [thread(2)]),
      at: 50,
    });
    expect(readInboxSnapshot('livediagram')).toBeNull();
  });

  it('lists its rows only to the person it names', () => {
    writeInboxSnapshot('liveplanner', ['user_me', 'guest_1'], rows([action(1)]));
    expect(inboxSnapshotRows('liveplanner', 'user_me').actions).toHaveLength(1);
    expect(inboxSnapshotRows('liveplanner', 'user_other')).toEqual(rows([]));
    expect(inboxSnapshotRows('liveplanner', null)).toEqual(rows([]));
  });

  it("makes the rows' \"me\" the viewer's when they read as the snapshot's second id", () => {
    writeInboxSnapshot(
      'liveplanner',
      ['user_me', 'guest_1'],
      rows([action(1), action(2, { assigneeId: 'user_ana', assignerId: 'user_me' })]),
    );
    const read = inboxSnapshotRows('liveplanner', 'guest_1').actions;
    expect(read.map((a) => [a.assigneeId, a.assignerId])).toEqual([
      ['user_ana', 'guest_1'],
      ['guest_1', 'guest_1'],
    ]);
  });

  it('keeps the newest INBOX_SNAPSHOT_MAX actions and threads, long text cut short', () => {
    const many = Array.from({ length: INBOX_SNAPSHOT_MAX + 50 }, (_, i) =>
      action(i, { description: 'x'.repeat(5_000) }),
    );
    const threads = Array.from({ length: INBOX_SNAPSHOT_MAX + 50 }, (_, i) => thread(i));
    writeInboxSnapshot('liveplanner', ['user_me'], rows(many, threads));
    const kept = readInboxSnapshot('liveplanner')!.rows;
    expect(kept.actions).toHaveLength(INBOX_SNAPSHOT_MAX);
    expect(kept.threads).toHaveLength(INBOX_SNAPSHOT_MAX);
    expect(kept.actions[0]!.updatedAt).toBe(INBOX_SNAPSHOT_MAX + 49);
    expect(kept.actions[0]!.description.length).toBeLessThanOrEqual(280);
    // The worst case stays a small string: well under localStorage's few megabytes.
    expect(localStorage.getItem(inboxSnapshotKey('liveplanner'))!.length).toBeLessThan(200_000);
  });

  it('is heard as it changes in this tab, and a write that changes nothing wakes no one', () => {
    const heard = vi.fn();
    const stop = subscribeInboxSnapshot('liveplanner', heard);
    writeInboxSnapshot('liveplanner', ['user_me'], rows([action(1)]), localStorage, 1);
    expect(heard).toHaveBeenCalledTimes(1);
    writeInboxSnapshot('liveplanner', ['user_me'], rows([action(1)]), localStorage, 2);
    expect(heard).toHaveBeenCalledTimes(1);
    dropInboxSnapshot('liveplanner');
    expect(heard).toHaveBeenCalledTimes(2);
    expect(readInboxSnapshot('liveplanner')).toBeNull();
    stop();
    writeInboxSnapshot('liveplanner', ['user_me'], rows([action(3)]));
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('reads nothing from a broken or blocked store', () => {
    localStorage.setItem(inboxSnapshotKey('liveplanner'), '{not json');
    expect(inboxSnapshotRows('liveplanner', 'user_me')).toEqual(rows([]));
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(() => writeInboxSnapshot('liveplanner', ['user_me'], rows([]), blocked)).not.toThrow();
    expect(inboxSnapshotRows('liveplanner', 'user_me', blocked)).toEqual(rows([]));
  });
});

describe("an app's keeper", () => {
  function keeper(hasItems = () => true) {
    const compute = vi.fn(async (account: string | null) => ({
      ownerIds: [account ?? 'guest_1'],
      rows: rows([action(1, { assigneeId: account ?? 'guest_1' })]),
    }));
    return { compute, keep: inboxSnapshotKeeper({ app: 'liveplanner', compute, hasItems }) };
  }

  it('reads nothing until the page says who is signed in, then once the store is quiet', async () => {
    vi.useFakeTimers();
    const { compute, keep } = keeper();
    keep.schedule();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(compute).not.toHaveBeenCalled();
    keep.setAccount('user_me');
    // A burst of writes: one read, 1.5 s after the last.
    for (let i = 0; i < 10; i++) {
      keep.schedule();
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(compute).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(compute).toHaveBeenCalledWith('user_me');
    expect(inboxSnapshotRows('liveplanner', 'user_me').actions).toHaveLength(1);
  });

  it('drops the snapshot once this browser holds no offline items', async () => {
    writeInboxSnapshot('liveplanner', ['user_me'], rows([action(1)]));
    const { compute, keep } = keeper(() => false);
    keep.setAccount('user_me');
    await keep.flush();
    expect(compute).not.toHaveBeenCalled();
    expect(readInboxSnapshot('liveplanner')).toBeNull();
  });

  it("keeps the rows a panel's read publishes", () => {
    const { keep } = keeper();
    keep.publish(['user_me', null], rows([action(1)]));
    expect(readInboxSnapshot('liveplanner')!.ownerIds).toEqual(['user_me']);
    keep.publish([null], rows([action(2)]));
    expect(readInboxSnapshot('liveplanner')!.rows.actions[0]!.actionId).toBe('card:c1');
  });

  it('keeps going when a read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const keep = inboxSnapshotKeeper({
      app: 'liveplanner',
      hasItems: () => true,
      compute: () => Promise.reject(new Error('idb')),
    });
    keep.setAccount(null);
    await keep.flush();
    expect(readInboxSnapshot('liveplanner')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
