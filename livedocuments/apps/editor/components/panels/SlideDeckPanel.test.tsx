// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Deck } from '@livedocuments/document';
import type { SlideDeckState } from '@/app/document/[id]/useSlideDeck';
import { SlideDeckPanel } from './SlideDeckPanel';

// docs/specs/007-editor/pages-mode.md "Slides": the Slide Deck panel on a Pages tab.
vi.mock('@/hooks/canvas/useSelectionStore', () => ({ useSelectionOf: () => new Set() }));
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

afterEach(cleanup);
// jsdom has no ResizeObserver; the panel's measuring is not under test here.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const noop = () => {};
function state(
  deck: Deck,
  pageLabels = new Map<string, string | null>(),
  ownPageSlideIds = new Set<string>(),
): SlideDeckState {
  return {
    deck,
    ownPageSlideIds,
    openSlideId: null,
    openSlideInEditor: noop,
    runnable: [],
    thumbs: new Map(),
    pageLabels,
    headlines: new Map(),
    newSlideFromSelection: noop,
    newPageSlide: noop,
    addSelectionToSlide: noop,
    removeFromSlide: noop,
    renameSlide: noop,
    setSlideNotes: noop,
    setSlideMinutes: noop,
    deleteSlide: noop,
    toggleSlideHidden: noop,
    duplicateSlide: noop,
    reorderSlides: noop,
    start: async () => {},
    startingDeck: false,
    config: {},
    updateConfig: noop,
  } as unknown as SlideDeckState;
}

const tabs = [
  { id: 'a', name: 'Here' },
  { id: 'b', name: 'There' },
];
const pages = [{ id: 'p1', label: 'Page 1 · A4 · Portrait' }];

function panel(deck: Deck, labels?: Map<string, string | null>, withPages = true) {
  return render(
    <SlideDeckPanel
      state={state(deck, labels)}
      tabs={tabs}
      activeTabId="a"
      isReadOnly={false}
      {...(withPages ? { pages } : {})}
      position={null}
      onMoveTo={noop}
    />,
  );
}

describe('SlideDeckPanel on a Pages tab', () => {
  it('names the page picker button in the empty hint', () => {
    panel({ slides: [] });
    expect(screen.getByText(/pick it below and press/).textContent).toBe(
      'Slide pages join the deck on their own. For any other page, pick it below and press Add as slide.',
    );
  });

  it('keeps the selection hint off a Pages tab', () => {
    panel({ slides: [] }, undefined, false);
    expect(screen.getByText(/first slide, then press/).textContent).toContain(
      'then press New slide.',
    );
  });

  it("names a page slide's page on another tab, and a deleted page as deleted", () => {
    panel(
      {
        slides: [
          { id: 's1', tabId: 'b', elementIds: [], pageId: 'p9' },
          { id: 's2', tabId: 'a', elementIds: [], pageId: 'gone' },
        ],
      },
      new Map([
        ['s1', 'Launch · Slide (16:9)'],
        ['s2', null],
      ]),
    );
    expect(screen.getByText(/There · Launch · Slide \(16:9\)/)).toBeTruthy();
    expect(screen.getByText(/Here · Page deleted/)).toBeTruthy();
  });

  it('confirms deleting a page slide with the page staying, and offers no selection edits', () => {
    panel(
      { slides: [{ id: 's1', tabId: 'a', elementIds: [], pageId: 'p1' }] },
      new Map([['s1', pages[0]!.label]]),
    );
    fireEvent.click(screen.getByRole('button', { name: /Options for/ }));
    expect(screen.queryByText('Selection')).toBeNull();
    fireEvent.click(screen.getByLabelText('Delete'));
    expect(screen.getByText(/The page stays\./)).toBeTruthy();
    expect(screen.queryByText(/on the canvas/)).toBeNull();
  });

  // docs/specs/007-editor/pages-mode.md "Slides": a slide page's own slide would come straight back.
  it("offers no Delete on a slide page's own slide, Hide still there", () => {
    render(
      <SlideDeckPanel
        state={state(
          { slides: [{ id: 's1', tabId: 'a', elementIds: [], pageId: 'p1' }] },
          new Map([['s1', pages[0]!.label]]),
          new Set(['s1']),
        )}
        tabs={tabs}
        activeTabId="a"
        isReadOnly={false}
        pages={pages}
        position={null}
        onMoveTo={noop}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Options for/ }));
    expect(screen.queryByLabelText('Delete')).toBeNull();
    expect(screen.getByText('Visibility')).toBeTruthy();
  });

  it('still offers selection edits on a slide of elements', () => {
    panel({ slides: [{ id: 's1', tabId: 'a', elementIds: ['x'] }] }, undefined, false);
    fireEvent.click(screen.getByRole('button', { name: /Options for/ }));
    expect(screen.getByText('Selection')).toBeTruthy();
  });
});

describe('the Slide Deck popover', () => {
  const popover = (
    deck: Deck,
    extra: Partial<SlideDeckState> = {},
    pageList: { id: string; label: string; slide?: boolean }[] = pages,
  ) =>
    render(
      <SlideDeckPanel
        state={{ ...state(deck), ...extra }}
        tabs={tabs}
        activeTabId="a"
        isReadOnly={false}
        pages={pageList}
        position={null}
        onMoveTo={noop}
        asPopover
        popoverOpen
      />,
    );

  it('names a slide by its headline, counts the deck and its minutes, and presents from a row', () => {
    const start = vi.fn(async () => {});
    popover(
      {
        slides: [
          { id: 's1', tabId: 'a', elementIds: [], pageId: 'p1', minutes: 3 },
          { id: 's2', tabId: 'a', elementIds: [], pageId: 'p2', minutes: 2, notes: 'Hi' },
        ],
      },
      {
        headlines: new Map([['s1', 'The next ten years']]),
        runnable: [{ slide: { id: 's1' } }, { slide: { id: 's2' } }] as never,
        start,
      },
    );
    expect(screen.getByText('The next ten years')).toBeTruthy();
    expect(screen.getByText('2 slides · 5 min')).toBeTruthy();
    expect(screen.getByLabelText('Has speaker notes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Present from slide 2' }));
    expect(start).toHaveBeenCalledWith('s2');
  });
});
