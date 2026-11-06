import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withNoteCards, type Slide } from '@livedocuments/document';
import * as offlineStore from '../offline/offline-store';
import { flushDocumentSavesBeacon } from './tabs';
import {
  KEEPALIVE_BUDGET_BYTES,
  bodyBytes,
  resetKeepaliveBudget,
  saveDocumentMetaOnUnload,
  takeKeepalive,
} from './unload-requests';

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

  // Work Tracker #575: a deck past the keepalive budget sends only the slides it changed, so it outlives the page.
  describe('a deck too large to go whole', () => {
    const slideWith = (id: string, text: string) =>
      withNoteCards({ id, tabId: 't1', elementIds: [] }, [{ id: `${id}-c`, text }]);
    // Forty slides of about 2 KB of notes each (mirrored): about 160 KB, far past the budget.
    const slides = Array.from({ length: 40 }, (_, i) => slideWith(`s${i}`, 'n'.repeat(1000)));
    const stored = (list: Slide[]) => JSON.stringify({ decks: [{ slides: list }] });
    const base = stored(slides);
    const sentDeck = (call: FetchCall) =>
      (JSON.parse(call.init.body as string) as { presentation?: string }).presentation;

    it('sends the changed slide alone, with its base cards, kept alive', () => {
      const typed = slideWith('s7', `${'n'.repeat(1000)} and one more line`);
      const mine = stored(slides.map((s) => (s.id === 's7' ? typed : s)));
      expect(bodyBytes(mine)).toBeGreaterThan(KEEPALIVE_BUDGET_BYTES);
      saveDocumentMetaOnUnload(
        'owner-1',
        { id: 'd1', presentation: mine, presentationBase: base },
        null,
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]!.init.keepalive).toBe(true);
      expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
        presentationPatch: {
          slides: [
            { slide: typed, baseCards: [{ id: 's7-c', text: 'n'.repeat(1000) }], after: 's6' },
          ],
        },
      });
    });

    it('sends the whole deck as a plain request when a slide moved, or with no base', () => {
      const moved = stored([slides[1]!, slides[0]!, ...slides.slice(2)]);
      saveDocumentMetaOnUnload(
        'owner-1',
        { id: 'd1', presentation: moved, presentationBase: base },
        null,
      );
      saveDocumentMetaOnUnload('owner-1', { id: 'd1', presentation: moved }, null);
      expect(calls.map((c) => c.init.keepalive)).toEqual([false, false]);
      expect(calls.map((c) => sentDeck(c))).toEqual([moved, moved]);
    });

    it('sends the whole deck as a plain request when even the changed slides do not fit', () => {
      const mine = stored(slides.map((s) => slideWith(s.id, 'm'.repeat(1000))));
      saveDocumentMetaOnUnload(
        'owner-1',
        { id: 'd1', presentation: mine, presentationBase: base },
        null,
      );
      expect(calls[0]!.init.keepalive).toBe(false);
      expect(sentDeck(calls[0]!)).toBe(mine);
    });
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
