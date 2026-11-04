// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pageSlideIdFor, storePresentation, type Deck, type Tab } from '@livedocuments/document';
import { useSlideDeck } from './useSlideDeck';

// docs/specs/007-editor/pages-mode.md "Slides": slide pages are in the deck in page order, an editor saves that,
// a viewer only sees it, and a page slide dragged in the deck moves its page.
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const slide = (id: string) => ({ id, orientation: 'landscape', kind: 'slide' });
const deckTab = (pageIds: string[]) =>
  ({
    id: 't',
    name: 'Deck',
    elements: [],
    pages: pageIds.map(slide),
  }) as unknown as Tab;

function deckHook(tabs: Tab[], isReadOnly = false) {
  const saveDeck = vi.fn<(serialised: string | null) => void>();
  const hook = renderHook(
    ({ tabs: current }) =>
      useSlideDeck({
        prefs: {},
        commitPrefs: () => {},
        tabs: current,
        activeTabId: 't',
        setSelectedId: vi.fn(),
        setMultiSelectedIds: vi.fn(),
        isReadOnly,
        saveDeck,
      }),
    { initialProps: { tabs } },
  );
  return { ...hook, saveDeck };
}
const pageOrder = (deck: Deck) => deck.slides.map((s) => s.pageId);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the deck following the slide pages', () => {
  it('puts the slide pages in on top of the stored deck, and saves it once', () => {
    const { result, saveDeck } = deckHook([deckTab(['a', 'b'])]);
    const stored: Deck = { slides: [{ id: 'kept', tabId: 'other', elementIds: ['x'] }] };
    act(() => result.current.hydrateDeck(JSON.stringify(storePresentation(stored))));
    act(() => result.current.followPages());
    expect(result.current.deck.slides.map((s) => s.id)).toEqual([
      'kept',
      pageSlideIdFor('t', 'a'),
      pageSlideIdFor('t', 'b'),
    ]);
    act(() => {
      vi.runAllTimers();
    });
    expect(saveDeck).toHaveBeenCalledTimes(1);
    // A second pass with nothing new saves nothing.
    act(() => result.current.followPages());
    act(() => {
      vi.runAllTimers();
    });
    expect(saveDeck).toHaveBeenCalledTimes(1);
  });

  it('follows a page reorder', () => {
    const { result, rerender } = deckHook([deckTab(['a', 'b', 'c'])]);
    act(() => result.current.hydrateDeck(null));
    act(() => result.current.followPages());
    rerender({ tabs: [deckTab(['c', 'a', 'b'])] });
    act(() => result.current.followPages());
    expect(pageOrder(result.current.deck)).toEqual(['c', 'a', 'b']);
  });

  it('shows a viewer the followed deck without saving it', () => {
    const { result, saveDeck } = deckHook([deckTab(['a', 'b'])], true);
    act(() => result.current.hydrateDeck(null));
    act(() => result.current.followPages());
    act(() => {
      vi.runAllTimers();
    });
    expect(pageOrder(result.current.deck)).toEqual(['a', 'b']);
    expect(saveDeck).not.toHaveBeenCalled();
  });

  it('presents in Contents order once a page moves (pages-mode.md "Slides")', () => {
    const { result, rerender } = deckHook([deckTab(['a', 'b', 'c'])]);
    act(() => result.current.hydrateDeck(null));
    act(() => result.current.followPages());
    rerender({ tabs: [deckTab(['b', 'c', 'a'])] });
    act(() => result.current.followPages());
    expect(result.current.runnable.map((r) => r.slide.pageId)).toEqual(['b', 'c', 'a']);
  });
});
