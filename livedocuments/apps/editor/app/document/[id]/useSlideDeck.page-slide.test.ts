// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { storePresentation, type Tab } from '@livedocuments/document';
import { useSlideDeck } from './useSlideDeck';

// docs/specs/007-editor/pages-mode.md "Slides": any page joins the deck with Add to Slides, the show runs from a
// page's slide with Present From Here, and a deck the retired Slide Deck panel made still presents as stored.
const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({
  track: (...args: Parameters<typeof track>) => track(...args),
}));
vi.mock('@/lib/editor-deferred-code', () => ({ loadPresentationOverlay: () => Promise.resolve() }));

const tabs = [
  {
    id: 'a',
    name: 'Here',
    elements: [],
    pages: [
      { id: 'i1', orientation: 'portrait' },
      { id: 'i2', orientation: 'portrait' },
    ],
  },
  {
    id: 'b',
    name: 'There',
    elements: [],
    pages: [{ id: 'p2', orientation: 'landscape', name: 'Launch', kind: 'slide' }],
  },
] as unknown as Tab[];

function deckHook(isReadOnly = false) {
  return renderHook(() =>
    useSlideDeck({
      prefs: {},
      commitPrefs: () => {},
      tabs,
      activeTabId: 'a',
      setSelectedId: vi.fn(),
      setMultiSelectedIds: vi.fn(),
      isReadOnly,
    }),
  );
}

const run = (r: { current: ReturnType<typeof useSlideDeck> }) =>
  r.current.runnable.map((x) => x.slide.id);

describe('useSlideDeck page slides', () => {
  it('adds an infographic page as a page slide of the active tab, counted as one', () => {
    const { result } = deckHook();
    act(() => result.current.newPageSlide('i2'));
    expect(result.current.deck.slides).toEqual([
      expect.objectContaining({ tabId: 'a', pageId: 'i2', elementIds: [] }),
    ]);
    expect(track).toHaveBeenCalledWith('UI', 'Added', 'PageSlide');
  });

  it('adds nothing for someone who cannot change the deck', () => {
    const { result } = deckHook(true);
    act(() => result.current.newPageSlide('i2'));
    expect(result.current.deck.slides).toEqual([]);
  });

  it("presents from the slide asked for, in the open tab's own show", async () => {
    const { result } = deckHook();
    act(() =>
      result.current.hydrateDeck(
        JSON.stringify(
          storePresentation({
            slides: [
              { id: 'sb', tabId: 'b', elementIds: [], pageId: 'p2' },
              { id: 'sa', tabId: 'a', elementIds: [], pageId: 'i1' },
              { id: 'sa2', tabId: 'a', elementIds: ['x'] },
            ],
          }),
        ),
      ),
    );
    // Tab b's slide is b's show, never a's.
    expect(run(result)).toEqual(['sa', 'sa2']);
    await act(() => result.current.start('sa2'));
    expect(result.current.presentingAt).toBe(1);
  });

  it('presents a stored selection slide and a page slide copy as they were', async () => {
    const { result } = deckHook();
    act(() =>
      result.current.hydrateDeck(
        JSON.stringify(
          storePresentation({
            slides: [
              { id: 'sel', tabId: 'a', elementIds: ['x'], name: 'Picked', minutes: 3 },
              { id: 'p', tabId: 'a', elementIds: [], pageId: 'i1' },
              { id: 'copy', tabId: 'a', elementIds: [], pageId: 'i1', hidden: true },
              { id: 'p-again', tabId: 'a', elementIds: [], pageId: 'i1' },
            ],
          }),
        ),
      ),
    );
    expect(run(result)).toEqual(['sel', 'p', 'p-again']);
    expect(result.current.deck.slides.find((s) => s.id === 'sel')).toMatchObject({
      name: 'Picked',
      minutes: 3,
    });
    await act(() => result.current.start());
    expect(result.current.presentingAt).toBe(0);
  });
});
