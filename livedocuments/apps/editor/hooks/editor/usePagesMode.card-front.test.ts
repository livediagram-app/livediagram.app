// @vitest-environment jsdom

// The card in front (docs/specs/007-editor/flashcards.md "Flipping"): when the card in front is taken
// away (an undo of the split that made it, a peer's delete), the card before its place comes to the
// front and stays there; it never steps back to the stack's first card.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { newFlashcardPage, type Tab } from '@livedocuments/document';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { usePagesMode } from './usePagesMode';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/flashcard-flip', () => ({ flipCard: vi.fn(), pictureCard: vi.fn(() => null) }));

const stack = (...ids: string[]): Tab =>
  ({
    id: 't',
    name: 't',
    elements: [],
    pages: ids.map((id) => newFlashcardPage(id, `f-${id}`)),
  });

function mount(tab: Tab) {
  const canvas = document.createElement('main');
  Object.defineProperty(canvas, 'offsetWidth', { value: 1200 });
  Object.defineProperty(canvas, 'offsetHeight', { value: 800 });
  const viewport = createViewportStore(1);
  return renderHook(
    (activeTab: Tab) =>
      usePagesMode({
        activeTab,
        canEdit: true,
        tabLoaded: false,
        commitTabs: vi.fn(),
        canvasMainRef: { current: canvas },
        setViewportZoom: viewport.setZoom,
        setViewportOffset: viewport.setOffset,
        getViewport: viewport.get,
        clearSelection: vi.fn(),
        toastInfo: vi.fn(),
        frameFirstPageRef: { current: null },
        documentId: 'd',
        viewport,
      }),
    { initialProps: tab },
  );
}

const front = (h: ReturnType<typeof mount>) => h.result.current.cardStage?.pages[0]?.id;

describe('the card in front, taken away', () => {
  it('hands the front to the card before its place, and keeps it there', () => {
    const h = mount(stack('a', 'b', 'split', 'c'));
    act(() => h.result.current.focusPage('split'));
    expect(front(h)).toBe('split');
    // The split undone: its card goes.
    h.rerender(stack('a', 'b', 'c'));
    expect(front(h)).toBe('b');
    // Any later render (an edit elsewhere) keeps it.
    h.rerender(stack('a', 'b', 'c'));
    h.rerender(stack('a', 'b', 'c'));
    expect(front(h)).toBe('b');
  });

  it('brings the next card to the front when the first card goes', () => {
    const h = mount(stack('a', 'b', 'c'));
    h.rerender(stack('b', 'c'));
    expect(front(h)).toBe('b');
  });
});
