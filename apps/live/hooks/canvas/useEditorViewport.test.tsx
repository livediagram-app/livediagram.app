// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type Tab } from '@livediagram/document';
import { createSelectionStore } from '@/lib/selection-store';
import { useEditorViewport } from './useEditorViewport';

// On a phone, an element just added (and selected by the add) scrolls into view. The selection is read
// from the store when the board changes (docs/specs/008-canvas/blueprints/selection-store.md).

const tabOf = (elements: Element[]) => ({ id: 't', name: 'T', elements }) as unknown as Tab;
const width = window.innerWidth;
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'Date'],
  });
});
afterEach(() => {
  vi.useRealTimers();
  window.innerWidth = width;
});

function setup() {
  window.innerWidth = 400;
  const selection = createSelectionStore();
  const near = createShape('square', 10, 10);
  const view = renderHook(
    ({ tab }) => useEditorViewport({ activeTab: tab, readSelection: selection.get }),
    { initialProps: { tab: tabOf([near]) } },
  );
  const main = document.createElement('main');
  main.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 400, bottom: 800, width: 400, height: 800 }) as DOMRect;
  (view.result.current.canvasMainRef as { current: HTMLElement | null }).current = main;
  return { selection, near, view };
}

describe('useEditorViewport scrolling a new element into view', () => {
  it('scrolls to an added element that the add selected', () => {
    const { selection, near, view } = setup();
    const before = view.result.current.viewportOffset;
    const far = createShape('square', 3000, 3000);

    act(() => {
      selection.setSelectedId(far.id);
      view.rerender({ tab: tabOf([near, far]) });
    });

    act(() => vi.advanceTimersByTime(800));
    expect(view.result.current.viewportOffset).not.toEqual(before);
  });

  it('leaves the view alone for an added element that is not selected', () => {
    const { near, view } = setup();
    const before = view.result.current.viewportOffset;

    act(() => view.rerender({ tab: tabOf([near, createShape('square', 3000, 3000)]) }));

    act(() => vi.advanceTimersByTime(800));
    expect(view.result.current.viewportOffset).toEqual(before);
  });
});
