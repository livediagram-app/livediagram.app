import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setOfflineBackend,
  isOfflineId,
  isOfflineIdSync,
  OfflineDocumentMissingError,
  offlineDeleteDocument,
  offlinePutRecord,
  offlineSaveDocumentMeta,
  offlineSaveTab,
} from './offline-store';
import { OFFLINE_IDS_CHANNEL, type OfflineIdChange } from './offline-ids';
import { memBackend, testRecord as rec, testTab as tab } from './offline-test-utils';
import type { OfflineBackend } from './offline-backend';

// docs/specs/006-document/offline-mode.md "Persistence architecture": every tab of a browser keeps
// its own cache of offline ids, told about the other tabs' changes on a BroadcastChannel.

// Another tab of the same browser: its own channel on the same name.
let otherTab: BroadcastChannel;
let heard: OfflineIdChange[];
let backend: OfflineBackend;

// Node delivers channel messages on a later turn of the event loop.
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  backend = memBackend();
  __setOfflineBackend(backend);
  heard = [];
  otherTab = new BroadcastChannel(OFFLINE_IDS_CHANNEL);
  otherTab.onmessage = (e: MessageEvent) => heard.push(e.data as OfflineIdChange);
});

afterEach(() => {
  otherTab.close();
  __setOfflineBackend(null);
  vi.restoreAllMocks();
});

describe('offline ids across tabs', () => {
  it('tells the other tabs when an id is registered and removed', async () => {
    await isOfflineId('d1');
    await offlinePutRecord(rec({ id: 'd1' }));
    await offlineDeleteDocument('d1');
    await settle();
    expect(heard).toEqual([
      { kind: 'add', id: 'd1' },
      { kind: 'remove', id: 'd1' },
    ]);
  });

  it("applies another tab's add and remove to this tab's cache", async () => {
    expect(await isOfflineId('d1')).toBe(false);
    otherTab.postMessage({ kind: 'add', id: 'd1' });
    await settle();
    expect(isOfflineIdSync('d1')).toBe(true);
    otherTab.postMessage({ kind: 'remove', id: 'd1' });
    await settle();
    expect(isOfflineIdSync('d1')).toBe(false);
    expect(await isOfflineId('d1')).toBe(false);
  });

  it('drops an id another tab removed while this tab was still loading its cache', async () => {
    await backend.put(rec({ id: 'd1' }));
    isOfflineIdSync('d1'); // starts listening, as any check does
    otherTab.postMessage({ kind: 'remove', id: 'd1' });
    await settle();
    // The load's snapshot still holds d1 (memBackend answers from before the purge here).
    expect(await isOfflineId('d1')).toBe(false);
  });

  it('ignores a malformed message', async () => {
    await isOfflineId('x');
    otherTab.postMessage({ kind: 'add' });
    otherTab.postMessage('d1');
    await settle();
    expect(isOfflineIdSync('d1')).toBe(false);
  });
});

describe('a write whose record another tab removed', () => {
  it('forgets the id and throws, rather than reporting the save as done', async () => {
    await offlinePutRecord(rec({ id: 'd1' }));
    // Another tab synced or purged it: the record goes, and this tab missed the message.
    await backend.delete('d1');
    await expect(offlineSaveTab('d1', tab('t1'), 200)).rejects.toBeInstanceOf(
      OfflineDocumentMissingError,
    );
    expect(isOfflineIdSync('d1')).toBe(false);
    expect(await backend.get('d1')).toBeUndefined();
  });

  it('stays a quiet no-op once this tab has forgotten the id itself (its own Sync Document)', async () => {
    await offlinePutRecord(rec({ id: 'd1' }));
    await offlineDeleteDocument('d1');
    await expect(offlineSaveTab('d1', tab('t1'), 200)).resolves.toBeUndefined();
    await expect(offlineSaveDocumentMeta('d1', { name: 'x' }, 200)).resolves.toBeUndefined();
    expect(await backend.get('d1')).toBeUndefined();
  });
});
