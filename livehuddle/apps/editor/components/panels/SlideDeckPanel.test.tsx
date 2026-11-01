// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Deck } from '@livehuddle/document';
import type { SlideDeckState } from '@/app/document/[id]/useSlideDeck';
import { SlideDeckPanel } from './SlideDeckPanel';

// The Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md).
vi.mock('@liveworkspace/workbench/hooks/canvas/useSelectionStore', () => ({
  useSelectionOf: () => new Set(),
}));
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

afterEach(cleanup);
// jsdom has no ResizeObserver; the panel's measuring is not under test here.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const noop = () => {};
function state(deck: Deck): SlideDeckState {
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
  } as unknown as SlideDeckState;
}

const tabs = [
  { id: 'a', name: 'Here' },
  { id: 'b', name: 'There' },
];

function panel(deck: Deck) {
  return render(
    <SlideDeckPanel
      state={state(deck)}
      tabs={tabs}
      activeTabId="a"
      isReadOnly={false}
      position={null}
      onMoveTo={noop}
    />,
  );
}

describe('SlideDeckPanel', () => {
  it('names the New slide button in the empty hint', () => {
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
});
