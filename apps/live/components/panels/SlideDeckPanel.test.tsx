// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Deck } from '@livediagram/document';
import type { SlideDeckState } from '@/app/document/[id]/useSlideDeck';
import { SlideDeckPanel } from './SlideDeckPanel';

// docs/specs/007-editor/illustrate-pages.md "Slides": the Slide Deck panel on an Illustrate tab.
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => undefined }));
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
function state(deck: Deck, pageLabels = new Map<string, string | null>()): SlideDeckState {
  return {
    deck,
    openSlideId: null,
    openSlideInEditor: noop,
    runnable: [],
    thumbs: new Map(),
    pageLabels,
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
const pages = [{ id: 'p1', label: 'Page 1 · A4 · Portrait · Infographic' }];

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

describe('SlideDeckPanel on an Illustrate tab', () => {
  it('names the page picker button in the empty hint', () => {
    panel({ slides: [] });
    expect(screen.getByText(/Pick a page, then press/).textContent).toBe(
      'No slides yet. Pick a page, then press Add as slide.',
    );
  });

  it('keeps the selection hint off an Illustrate tab', () => {
    panel({ slides: [] }, undefined, false);
    expect(screen.getByText(/No slides yet/).textContent).toContain('then press New slide.');
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
        ['s1', 'Launch · Slide (16:9) · Slide'],
        ['s2', null],
      ]),
    );
    expect(screen.getByText(/There · Launch · Slide \(16:9\) · Slide/)).toBeTruthy();
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

  it('still offers selection edits on a slide of elements', () => {
    panel({ slides: [{ id: 's1', tabId: 'a', elementIds: ['x'] }] }, undefined, false);
    fireEvent.click(screen.getByRole('button', { name: /Options for/ }));
    expect(screen.getByText('Selection')).toBeTruthy();
  });
});
