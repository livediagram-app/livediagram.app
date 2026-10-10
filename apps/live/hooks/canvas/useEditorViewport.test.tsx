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
    const before = view.result.current.viewport.get().offset;
    const far = createShape('square', 3000, 3000);

    act(() => {
      selection.setSelectedId(far.id);
      view.rerender({ tab: tabOf([near, far]) });
    });

    act(() => vi.advanceTimersByTime(800));
    expect(view.result.current.viewport.get().offset).not.toEqual(before);
  });

  it('leaves an added board or Sheet to its Focus glide', () => {
    const { selection, near, view } = setup();
    const before = view.result.current.viewport.get().offset;
    const sheet = createShape('plan-sheet', 3000, 3000);
    act(() => {
      selection.setSelectedId(sheet.id);
      view.rerender({ tab: tabOf([near, sheet]) });
    });
    act(() => vi.advanceTimersByTime(800));
    expect(view.result.current.viewport.get().offset).toEqual(before);
  });

  it('leaves the view alone for an added element that is not selected', () => {
    const { near, view } = setup();
    const before = view.result.current.viewport.get().offset;

    act(() => view.rerender({ tab: tabOf([near, createShape('square', 3000, 3000)]) }));

    act(() => vi.advanceTimersByTime(800));
    expect(view.result.current.viewport.get().offset).toEqual(before);
  });
});

// docs/specs/008-canvas/canvas-performance.md "A pan or zoom renders the canvas, not the editor".
describe('useEditorViewport view', () => {
  it('never renders its host for a zoom or a pan, and reads the newest view', () => {
    const selection = createSelectionStore();
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useEditorViewport({ activeTab: tabOf([]), readSelection: selection.get });
    });
    const before = renders;

    act(() => result.current.setViewportZoom(2));
    act(() => result.current.setViewportOffset({ x: 30, y: -10 }));

    expect(renders).toBe(before);
    expect(result.current.viewport.get()).toEqual({ zoom: 2, offset: { x: 30, y: -10 } });
    expect(result.current.zoomRef.current).toBe(2);
    expect(result.current.viewportOffsetRef.current).toEqual({ x: 30, y: -10 });
  });
});

// docs/specs/026-plan/plan-board.md "Focus": glide to fit an element; pressed again, out to the whole tab.
describe('useEditorViewport focus', () => {
  function sized() {
    const s = setup();
    const main = s.view.result.current.canvasMainRef.current!;
    Object.defineProperty(main, 'offsetWidth', { value: 400 });
    Object.defineProperty(main, 'offsetHeight', { value: 800 });
    return s;
  }

  it('glides to fit an element, then out to the whole tab', () => {
    const { view } = sized();
    const far = createShape('square', 3000, 3000);
    act(() => view.rerender({ tab: tabOf([createShape('square', 10, 10), far]) }));
    const box = { x: far.x, y: far.y, w: far.width, h: far.height };
    act(() => view.result.current.focusOn(box, 1.5));
    // Part way there, still moving.
    act(() => vi.advanceTimersByTime(100));
    const mid = view.result.current.viewport.get();
    act(() => vi.advanceTimersByTime(800));
    const fitted = view.result.current.viewport.get();
    expect(fitted.zoom).toBeCloseTo(1.5);
    expect(fitted.offset).not.toEqual(mid.offset);
    // Already fitted: out to everything.
    act(() => view.result.current.focusOn(box, 1.5));
    act(() => vi.advanceTimersByTime(800));
    expect(view.result.current.viewport.get().zoom).toBeLessThan(fitted.zoom);
  });

  it('stops gliding when anything else moves the view, and when it unmounts', () => {
    const { view } = sized();
    const far = createShape('square', 3000, 3000);
    act(() => view.rerender({ tab: tabOf([createShape('square', 10, 10), far]) }));
    const box = { x: far.x, y: far.y, w: far.width, h: far.height };
    act(() => view.result.current.focusOn(box, 1.5));
    act(() => vi.advanceTimersByTime(100));
    // A wheel or pinch of the person's own.
    act(() => view.result.current.viewport.setOffset({ x: 7, y: 9 }));
    act(() => vi.advanceTimersByTime(800));
    expect(view.result.current.viewport.get().offset).toEqual({ x: 7, y: 9 });
    act(() => view.result.current.focusOn(box, 1.5));
    act(() => vi.advanceTimersByTime(100));
    const at = view.result.current.viewport.get();
    view.unmount();
    act(() => vi.advanceTimersByTime(800));
    expect(view.result.current.viewport.get()).toEqual(at);
  });

  it('jumps at once under reduced motion, and ignores an empty box', () => {
    const { view } = sized();
    document.documentElement.classList.add('reduce-motion');
    act(() => view.result.current.focusOn({ x: 0, y: 0, w: 100, h: 100 }, 1));
    expect(view.result.current.viewport.get().zoom).toBeCloseTo(1);
    const before = view.result.current.viewport.get();
    act(() => view.result.current.focusOn({ x: 0, y: 0, w: 0, h: 0 }));
    expect(view.result.current.viewport.get()).toEqual(before);
    document.documentElement.classList.remove('reduce-motion');
  });
});
