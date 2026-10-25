// @vitest-environment jsdom
// The Inbox's This Browser snapshot (inbox-snapshot.ts): the offline store's writes keep it, once the store has been
// quiet a moment, for the person the page says is signed in, so the Explorer page on this address lists the same
// rows as the editor's panel; it goes with the last plan kept here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { itemPersonId } from '@liveplanner/items';
import { inboxSnapshotRows, readInboxSnapshot } from '@liveworkspace/explorer/this-browser';
import { inboxSnapshot } from './inbox-snapshot';
import {
  __setOfflineBackend,
  offlineCreateProject,
  offlineDeleteProject,
  offlinePutRecord,
} from './offline-store';
import { memBackend, testRecord } from './offline-test-utils';

afterEach(() => {
  vi.useRealTimers();
  __setOfflineBackend(null);
  localStorage.clear();
});

describe("the Inbox's This Browser snapshot", () => {
  it('is worked out once the store is quiet after a write, and dropped with the last plan', async () => {
    __setOfflineBackend(memBackend());
    inboxSnapshot.setAccount('user_me');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await offlineCreateProject({ id: 'a', name: 'Alpha' }, 1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(readInboxSnapshot('liveplanner')).toBeNull();
    vi.useRealTimers();
    await inboxSnapshot.flush();
    expect(readInboxSnapshot('liveplanner')?.ownerIds).toEqual(['user_me']);

    await offlineDeleteProject('a');
    await inboxSnapshot.flush();
    expect(readInboxSnapshot('liveplanner')).toBeNull();
  });

  it('lists a card assigned to the reader in a plan kept here, without the panel open', async () => {
    __setOfflineBackend(memBackend());
    inboxSnapshot.setAccount('user_me');
    const mine = { id: await itemPersonId('user_me'), name: 'Me', color: '#123' };
    const person = { id: 'x', name: 'X', color: '#000' };
    await offlinePutRecord(
      testRecord({
        id: 'p1',
        name: 'Launch',
        items: [
          {
            id: 'card-1',
            type: 'task',
            key: 7,
            rank: 'a',
            fields: { title: 'Book the venue', status: 'todo', assignee: mine },
            rev: 1,
            createdAt: 1,
            updatedAt: 10,
            createdBy: person,
            updatedBy: person,
          },
        ],
      }),
    );
    await inboxSnapshot.flush();
    const rows = inboxSnapshotRows('liveplanner', 'user_me');
    expect(rows.actions.map((a) => [a.itemId, a.elementId, a.assigneeId, a.card?.key])).toEqual([
      ['p1', 'card-1', 'user_me', 7],
    ]);
    // Another account in the same browser sees none of it.
    expect(inboxSnapshotRows('liveplanner', 'user_other').actions).toEqual([]);
  });
});
