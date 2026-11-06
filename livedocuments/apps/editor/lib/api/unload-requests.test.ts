import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// First: the offline store's own imports come back round to this module, which must be the one holding the mock.
import {
  KEEPALIVE_BUDGET_BYTES,
  resetKeepaliveBudget,
  saveDocumentMetaOnUnload,
  takeKeepalive,
} from './unload-requests';
import { flushDocumentSavesBeacon } from './tabs';
import * as offlineStore from '../offline/offline-store';

vi.mock('../offline/offline-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../offline/offline-store')>()),
  isOfflineIdSync: vi.fn(() => false),
  offlineSaveDocumentMeta: vi.fn(async () => {}),
}));

// docs/specs/012-collaboration/speaker-note-cards.md "Saving": the deck's save as the page goes is synchronous, kept
// alive while it fits the page's keepalive budget, which the tab beacon shares.

type FetchCall = { url: string; init: RequestInit };
let calls: FetchCall[];

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(new Response(null, { status: 204 }));
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetKeepaliveBudget();
});

const deck = (chars: number) => JSON.stringify({ decks: [{ slides: [], pad: 'x'.repeat(chars) }] });

describe('takeKeepalive', () => {
  it('takes bodies from one budget until it runs out, and refills it on the next task', () => {
    vi.useFakeTimers();
    expect(takeKeepalive(KEEPALIVE_BUDGET_BYTES - 10)).toBe(true);
    expect(takeKeepalive(11)).toBe(false);
    expect(takeKeepalive(10)).toBe(true);
    expect(takeKeepalive(1)).toBe(false);
    vi.advanceTimersByTime(0);
    expect(takeKeepalive(KEEPALIVE_BUDGET_BYTES)).toBe(true);
  });
});

describe('saveDocumentMetaOnUnload', () => {
  it('PUTs the deck and its base at once, kept alive, with headers built without waiting', () => {
    saveDocumentMetaOnUnload(
      'owner-1',
      { id: 'd1', presentation: deck(10), presentationBase: deck(5) },
      'code',
    );
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.url).toBe('/api/documents/d1');
    expect(call!.init.method).toBe('PUT');
    expect(call!.init.keepalive).toBe(true);
    expect(JSON.parse(call!.init.body as string)).toEqual({
      presentation: deck(10),
      presentationBase: deck(5),
    });
    const headers = call!.init.headers as Record<string, string>;
    expect(headers['X-Share-Code']).toBe('code');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('sends a deck past what the tab beacon left of the budget as a plain request', () => {
    const big = {
      id: 't1',
      name: 't1',
      elements: [
        { id: 'n', type: 'text', x: 0, y: 0, width: 1, height: 1, label: 'x'.repeat(50_000) },
      ],
    };
    flushDocumentSavesBeacon({
      ownerId: 'owner-1',
      documentId: 'd1',
      shareCode: null,
      changedTabs: [big] as never,
      deletedIds: [],
      loadedTabIds: new Set(),
      orderChanged: false,
      nameChanged: false,
      name: 'Pitch',
      tabs: [],
    });
    saveDocumentMetaOnUnload('owner-1', { id: 'd1', presentation: deck(20_000) }, null);
    expect(calls.map((c) => c.init.keepalive)).toEqual([true, false]);
  });

  it('skips the save for a signed-in owner with no cached token', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    saveDocumentMetaOnUnload('user_abc', { id: 'd1', presentation: deck(1) }, null);
    expect(calls).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[save] unload flush skipped'));
    warn.mockRestore();
  });

  it('writes an Offline Mode deck to this browser instead', () => {
    vi.mocked(offlineStore.isOfflineIdSync).mockReturnValueOnce(true);
    saveDocumentMetaOnUnload('owner-1', { id: 'd1', presentation: null }, null);
    expect(calls).toHaveLength(0);
    expect(offlineStore.offlineSaveDocumentMeta).toHaveBeenCalledWith(
      'd1',
      { presentation: null },
      expect.any(Number),
    );
  });
});
