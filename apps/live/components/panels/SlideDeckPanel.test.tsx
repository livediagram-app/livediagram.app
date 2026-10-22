// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Deck } from '@liveplanner/document';
import type { SlideDeckState } from '@/app/document/[id]/useSlideDeck';
import { SlideDeckPanel } from './SlideDeckPanel';

// docs/specs/012-collaboration/presentation-mode.md "The Slide Deck panel".
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
function state(deck: Deck, extra: Partial<SlideDeckState> = {}): SlideDeckState {
  return {
    deck,
    openSlideId: null,
    openSlideInEditor: noop,
    runnable: [],
    thumbs: new Map(),
    headlines: new Map(),
    newSlideFromSelection: noop,
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
    ...extra,
  } as unknown as SlideDeckState;
}

const tabs = [
  { id: 'a', name: 'Here' },
  { id: 'b', name: 'There' },
];

function panel(deck: Deck, extra: Partial<SlideDeckState> = {}) {
  return render(
    <SlideDeckPanel
      state={state(deck, extra)}
      tabs={tabs}
      activeTabId="a"
      isReadOnly={false}
      position={null}
      onMoveTo={noop}
    />,
  );
}

describe('SlideDeckPanel', () => {
  it('says how to make the first slide', () => {
    panel({ slides: [] });
    expect(screen.getByText(/first slide, then press/).textContent).toContain(
      'then press New slide.',
    );
  });

  it('offers selection edits on a slide of elements', () => {
    panel({ slides: [{ id: 's1', tabId: 'a', elementIds: ['x'] }] });
    fireEvent.click(screen.getByRole('button', { name: /Options for/ }));
    expect(screen.getByText('Selection')).toBeTruthy();
  });

  it('confirms deleting a slide with its elements staying on the canvas', () => {
    panel({ slides: [{ id: 's1', tabId: 'a', elementIds: ['x'] }] });
    fireEvent.click(screen.getByRole('button', { name: /Options for/ }));
    fireEvent.click(screen.getByLabelText('Delete'));
    expect(screen.getByText(/The element stays on the canvas\./)).toBeTruthy();
  });

  it('names a slide by its headline, its tab, and counts the deck and its minutes', () => {
    panel(
      {
        slides: [
          { id: 's1', tabId: 'b', elementIds: ['x'], minutes: 3 },
          { id: 's2', tabId: 'a', elementIds: ['y', 'z'], minutes: 2, notes: 'Hi' },
        ],
      },
      { headlines: new Map([['s1', 'The next ten years']]) },
    );
    expect(screen.getByText('The next ten years')).toBeTruthy();
    expect(screen.getByText(/There · 1 element/)).toBeTruthy();
    expect(screen.getByText(/Here · 2 elements/)).toBeTruthy();
    expect(screen.getByText('2 slides · 5 min')).toBeTruthy();
    expect(screen.getByLabelText('Has speaker notes')).toBeTruthy();
  });
});
