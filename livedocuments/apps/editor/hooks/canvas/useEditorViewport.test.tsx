// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element, type Tab } from '@livedocuments/document';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
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

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(view.result.current.viewport.get().offset).not.toEqual(before);
  });

  it('leaves the view alone for an added element that is not selected', () => {
    const { near, view } = setup();
    const before = view.result.current.viewport.get().offset;

    act(() => view.rerender({ tab: tabOf([near, createShape('square', 3000, 3000)]) }));

    act(() => {
      vi.advanceTimersByTime(800);
    });
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

// Focus: glide to fit an element; pressed again, out to the whole tab.
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
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const mid = view.result.current.viewport.get();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    const fitted = view.result.current.viewport.get();
    expect(fitted.zoom).toBeCloseTo(1.5);
    expect(fitted.offset).not.toEqual(mid.offset);
    // Already fitted: out to everything.
    act(() => view.result.current.focusOn(box, 1.5));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(view.result.current.viewport.get().zoom).toBeLessThan(fitted.zoom);
  });

  it('stops gliding when anything else moves the view, and when it unmounts', () => {
    const { view } = sized();
    const far = createShape('square', 3000, 3000);
    act(() => view.rerender({ tab: tabOf([createShape('square', 10, 10), far]) }));
    const box = { x: far.x, y: far.y, w: far.width, h: far.height };
    act(() => view.result.current.focusOn(box, 1.5));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    // A wheel or pinch of the person's own.
    act(() => view.result.current.viewport.setOffset({ x: 7, y: 9 }));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(view.result.current.viewport.get().offset).toEqual({ x: 7, y: 9 });
    act(() => view.result.current.focusOn(box, 1.5));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const at = view.result.current.viewport.get();
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(800);
    });
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

// docs/specs/007-editor/article-pages.md "Writing": the caret stays in sight, above a phone's on-screen keyboard
// too, which shrinks the visual viewport and leaves the canvas as it was.
describe('useEditorViewport revealing above the on-screen keyboard', () => {
  const reveal = (keyboard: number) => {
    const { view } = setup();
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: { offsetTop: 0, height: 800 - keyboard },
    });
    const { zoom: z, offset: off } = view.result.current.viewport.get();
    // A caret at screen y 600: inside the canvas's band (it ends at 800 - 88), under a 350 px keyboard.
    const cy = (600 - 400 * (1 - z)) / z - off.y;
    const cx = (200 - 200 * (1 - z)) / z - off.x;
    act(() => view.result.current.scrollIntoView(cx, cy, 2 / z, 20 / z));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    const after = view.result.current.viewport.get();
    Reflect.deleteProperty(window, 'visualViewport');
    return { before: off.y, after: after.offset.y, z: after.zoom };
  };

  it('leaves a caret the keyboard does not cover where it is', () => {
    const r = reveal(0);
    expect(r.after).toBe(r.before);
  });

  it('pans a caret under the keyboard up above it', () => {
    const r = reveal(350);
    // The caret's foot (620) lands 24 px above the keyboard's top (450).
    expect(r.after).toBeCloseTo(r.before - (620 - (450 - 24)) / r.z, 0);
  });
});
