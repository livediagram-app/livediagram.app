// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { parseStoredPresentation, storePresentation, type Tab } from '@livedocuments/document';
import { DECK_SAVE_DEBOUNCE_MS, useSlideDeck } from './useSlideDeck';

// docs/specs/012-collaboration/speaker-note-cards.md "Saving": typing saves the deck after a pause, and what is
// still waiting goes at once when the writing leaves the screen or the page goes.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/editor-deferred-code', () => ({ loadPresentationOverlay: () => Promise.resolve() }));

const tabs = [{ id: 'a', name: 'a', elements: [] }] as unknown as Tab[];

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function deckHook(isReadOnly = false) {
  const saveDeck = vi.fn<(serialised: string | null, opts?: { unload: true }) => void>();
  const hook = renderHook(() =>
    useSlideDeck({
      prefs: {},
      commitPrefs: () => {},
      tabs,
      activeTabId: 'a',
      setSelectedId: vi.fn(),
      setMultiSelectedIds: vi.fn(),
      isReadOnly,
      saveDeck,
    }),
  );
  act(() =>
    hook.result.current.hydrateDeck(
      JSON.stringify(storePresentation({ slides: [{ id: 's1', tabId: 'a', elementIds: ['x'] }] })),
    ),
  );
  return { ...hook, saveDeck };
}

// The texts of the first slide's cards in a saved deck.
const savedCards = (serialised: string | null | undefined) =>
  parseStoredPresentation(serialised)?.decks[0]?.slides[0]?.noteCards?.map((c) => c.text);

describe('deck saves', () => {
  it('saves a burst of typing once, after the pause', () => {
    const { result, saveDeck } = deckHook();
    for (const text of ['O', 'On', 'One'])
      act(() => result.current.setSlideNoteCards('s1', [{ id: 'c1', text }]));
    act(() => {
      vi.advanceTimersByTime(DECK_SAVE_DEBOUNCE_MS - 1);
    });
    expect(saveDeck).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(saveDeck).toHaveBeenCalledTimes(1);
    expect(savedCards(saveDeck.mock.calls[0]![0])).toEqual(['One']);
    expect(saveDeck.mock.calls[0]).toHaveLength(1);
  });

  it('flushes the waiting deck at once, with an update queued before the flush in the same save', () => {
    const { result, saveDeck } = deckHook();
    act(() => result.current.setSlideNoteCards('s1', [{ id: 'c1', text: 'One' }]));
    // A card closing: the blank card it removes and the flush arrive together.
    act(() => {
      result.current.setSlideNoteCards('s1', [
        { id: 'c1', text: 'One' },
        { id: 'c2', text: 'Two' },
      ]);
      result.current.flushDeckSave();
    });
    expect(saveDeck).toHaveBeenCalledTimes(1);
    expect(savedCards(saveDeck.mock.calls[0]![0])).toEqual(['One', 'Two']);
    // The timer it cut short sends nothing again.
    act(() => {
      vi.advanceTimersByTime(DECK_SAVE_DEBOUNCE_MS * 2);
    });
    expect(saveDeck).toHaveBeenCalledTimes(1);
  });

  it('sends nothing on a flush with nothing waiting', () => {
    const { result, saveDeck } = deckHook();
    act(() => result.current.flushDeckSave());
    expect(saveDeck).not.toHaveBeenCalled();
  });

  it('saves the waiting deck as the page goes, marked as unloading, and nothing on a second pagehide', () => {
    const { result, saveDeck } = deckHook();
    act(() => result.current.setSlideNoteCards('s1', [{ id: 'c1', text: 'Last words' }]));
    window.dispatchEvent(new Event('pagehide'));
    expect(saveDeck).toHaveBeenCalledTimes(1);
    expect(savedCards(saveDeck.mock.calls[0]![0])).toEqual(['Last words']);
    expect(saveDeck.mock.calls[0]![1]).toEqual({ unload: true });
    window.dispatchEvent(new Event('pagehide'));
    act(() => {
      vi.advanceTimersByTime(DECK_SAVE_DEBOUNCE_MS);
    });
    expect(saveDeck).toHaveBeenCalledTimes(1);
  });

  it('saves the waiting deck when the editor unmounts, where the timer would have dropped it', () => {
    const { result, saveDeck, unmount } = deckHook();
    act(() => result.current.setSlideNoteCards('s1', [{ id: 'c1', text: 'Before leaving' }]));
    unmount();
    expect(saveDeck).toHaveBeenCalledTimes(1);
    expect(saveDeck.mock.calls[0]![1]).toEqual({ unload: true });
    expect(savedCards(saveDeck.mock.calls[0]![0])).toEqual(['Before leaving']);
  });

  it('never saves for a session that cannot change the deck', () => {
    const { result, saveDeck, unmount } = deckHook(true);
    act(() => result.current.setSlideNoteCards('s1', [{ id: 'c1', text: 'Nope' }]));
    act(() => result.current.flushDeckSave());
    window.dispatchEvent(new Event('pagehide'));
    unmount();
    expect(saveDeck).not.toHaveBeenCalled();
  });

  // Work Tracker #265 "Done when": typing in a near-cap deck stays within two frames (33 ms). A keystroke maps the
  // deck's slides and renders; the deck is serialised only by the timer or a flush, never per key.
  it('keeps a keystroke in a near-cap deck within two frames, serialising nothing', () => {
    const fullSlide = (n: number) => ({
      id: `s${n}`,
      tabId: 'a',
      elementIds: [],
      noteCards: Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, text: 'w '.repeat(500) })),
    });
    const saveDeck = vi.fn<(serialised: string | null, opts?: { unload: true }) => void>();
    const { result } = renderHook(() =>
      useSlideDeck({
        prefs: {},
        commitPrefs: () => {},
        tabs,
        activeTabId: 'a',
        setSelectedId: vi.fn(),
        setMultiSelectedIds: vi.fn(),
        isReadOnly: false,
        saveDeck,
      }),
    );
    const stored = JSON.stringify(
      storePresentation({ slides: Array.from({ length: 12 }, (_, n) => fullSlide(n)) }),
    );
    act(() => result.current.hydrateDeck(stored));
    const cards = result.current.deck.slides[0]!.noteCards!;
    const keys = 50;
    const ms = cpuMsOf(() => {
      for (let k = 0; k < keys; k++)
        act(() =>
          result.current.setSlideNoteCards('s0', [
            { id: 'c0', text: 'x'.repeat(k + 1) },
            ...cards.slice(1),
          ]),
        );
    });
    expect(ms / keys).toBeLessThan(cpuBudgetMs(33));
    expect(saveDeck).not.toHaveBeenCalled();
    act(() => result.current.flushDeckSave());
    expect(saveDeck).toHaveBeenCalledTimes(1);
    expect(stored.length).toBeGreaterThan(200_000);
  });
});
