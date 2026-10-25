// @vitest-environment jsdom
// The Inbox's This Browser snapshot (inbox-snapshot.ts): the offline store's writes keep it, once the store has been
// quiet a moment, for the person the page says is signed in, so the Explorer page on this address lists the same
// rows as the editor's panel; it goes with the last document kept here.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readInboxSnapshot } from '@liveworkspace/explorer/this-browser';
import { inboxSnapshot } from './inbox-snapshot';
import { __setOfflineBackend, offlineCreateDocument, offlineDeleteDocument } from './offline-store';
import { memBackend } from './offline-test-utils';

afterEach(() => {
  vi.useRealTimers();
  __setOfflineBackend(null);
  localStorage.clear();
});

describe("the Inbox's This Browser snapshot", () => {
  it('is worked out once the store is quiet after a write, and dropped with the last document', async () => {
    __setOfflineBackend(memBackend());
    inboxSnapshot.setAccount('user_me');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await offlineCreateDocument({ id: 'a', name: 'Alpha' }, 1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(readInboxSnapshot('livedocuments')).toBeNull();
    vi.useRealTimers();
    await inboxSnapshot.flush();
    expect(readInboxSnapshot('livedocuments')?.ownerIds).toEqual(['user_me']);

    await offlineDeleteDocument('a');
    await inboxSnapshot.flush();
    expect(readInboxSnapshot('livedocuments')).toBeNull();
  });
});
