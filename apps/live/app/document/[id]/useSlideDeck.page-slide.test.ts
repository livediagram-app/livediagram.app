// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { storePresentation, type Deck, type Tab } from '@livediagram/document';
import { pageSlideLabels, useSlideDeck } from './useSlideDeck';

// docs/specs/007-editor/illustrate-pages.md "Slides": a page slide is its page. Its row names the
// page from the slide's own tab, pressing it frames the page, and a copy of it counts as a page
// slide.
const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...args: unknown[]) => track(...args) }));
vi.mock('@/hooks/ui/useSlideThumbnails', () => ({ useSlideThumbnails: () => new Map() }));

const tabs = [
  { id: 'a', name: 'Here', elements: [] },
  {
    id: 'b',
    name: 'There',
    elements: [],
    pages: [
      { id: 'p1', orientation: 'portrait' },
      { id: 'p2', orientation: 'landscape', name: 'Launch', kind: 'slide' },
    ],
  },
] as unknown as Tab[];

describe('pageSlideLabels', () => {
  it("names a page from the slide's own tab, and a missing page as gone", () => {
    const deck: Deck = {
      slides: [
        { id: 's1', tabId: 'b', elementIds: [], pageId: 'p1' },
        { id: 's2', tabId: 'b', elementIds: [], pageId: 'p2' },
        { id: 's3', tabId: 'b', elementIds: [], pageId: 'gone' },
        { id: 's4', tabId: 'nowhere', elementIds: [], pageId: 'p1' },
        { id: 's5', tabId: 'a', elementIds: ['x'] },
      ],
    };
    const labels = pageSlideLabels(deck, tabs);
    expect(labels.get('s1')).toBe('Page 1 · A4 · Portrait · Infographic');
    expect(labels.get('s2')).toBe('Launch · Slide (16:9) · Slide');
    expect(labels.get('s3')).toBeNull();
    expect(labels.get('s4')).toBeNull();
    expect(labels.has('s5')).toBe(false);
  });
});

function deckHook(framePage: (tabId: string, pageId: string) => void) {
  const setActiveId = vi.fn();
  const setSelectedId = vi.fn();
  const setMultiSelectedIds = vi.fn();
  const hook = renderHook(() =>
    useSlideDeck({
      tabs,
      activeTabId: 'a',
      setActiveId,
      readSelection: () => ({ ids: new Set() }) as never,
      setSelectedId,
      setMultiSelectedIds,
      isReadOnly: false,
      framePage,
    }),
  );
  return { ...hook, setActiveId, setSelectedId, setMultiSelectedIds };
}

describe('useSlideDeck page slides', () => {
  it("switches to a page slide's tab and frames its page", () => {
    const framePage = vi.fn();
    const { result, setActiveId, setSelectedId } = deckHook(framePage);
    act(() =>
      result.current.hydrateDeck(
        JSON.stringify(
          storePresentation({ slides: [{ id: 's1', tabId: 'b', elementIds: [], pageId: 'p2' }] }),
        ),
      ),
    );
    const id = result.current.deck.slides[0]!.id;
    act(() => result.current.openSlideInEditor(id));
    expect(setActiveId).toHaveBeenCalledWith('b');
    expect(setSelectedId).toHaveBeenCalledWith(null);
    expect(framePage).toHaveBeenCalledWith('b', 'p2');
  });

  it('frames nothing for a slide of elements', () => {
    const framePage = vi.fn();
    const { result } = deckHook(framePage);
    act(() =>
      result.current.hydrateDeck(
        JSON.stringify(
          storePresentation({ slides: [{ id: 's1', tabId: 'a', elementIds: ['x'] }] }),
        ),
      ),
    );
    act(() => result.current.openSlideInEditor(result.current.deck.slides[0]!.id));
    expect(framePage).not.toHaveBeenCalled();
  });

  it('counts a copy of a page slide as a page slide', () => {
    const { result } = deckHook(vi.fn());
    act(() => result.current.newPageSlide('p1'));
    track.mockClear();
    act(() => result.current.duplicateSlide(result.current.deck.slides[0]!.id));
    expect(result.current.deck.slides).toHaveLength(2);
    expect(track).toHaveBeenCalledWith('UI', 'Added', 'PageSlide');
  });
});
