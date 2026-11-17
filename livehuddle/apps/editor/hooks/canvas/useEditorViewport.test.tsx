// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSticky, type Element, type Tab } from '@livehuddle/document';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { notifyMapShown } from '@liveworkspace/workbench/lib/fit-clear-of-panel';
import { tabFitView } from '@/lib/tab-fit-view';
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
  const near = createSticky(10, 10);
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
    const far = createSticky(3000, 3000);

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

    act(() => view.rerender({ tab: tabOf([near, createSticky(3000, 3000)]) }));

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

// docs/specs/007-editor/editor-app.md "The keyboard never hides the caret": what is revealed stays above a phone's on-screen keyboard
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

// docs/specs/008-canvas/minimap.md "Fit leaves the Map clear": a Map that shows while a fit glides in (Walk to Edit as a
// warm open's catch-up lands) sends the glide on to the fit clear of it.
describe('useEditorViewport and the Map showing mid-glide', () => {
  function desktop() {
    window.innerWidth = 1400;
    const selection = createSelectionStore();
    const tab = tabOf([
      createSticky(0, 0),
      createSticky(800, 0),
      createSticky(0, 600),
      createSticky(800, 600),
    ]);
    const view = renderHook(() =>
      useEditorViewport({ activeTab: tab, readSelection: selection.get }),
    );
    const main = document.createElement('main');
    main.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 1400, bottom: 900, width: 1400, height: 900 }) as DOMRect;
    (view.result.current.canvasMainRef as { current: HTMLElement | null }).current = main;
    return { view, main, tab };
  }
  let map: HTMLElement | null = null;
  afterEach(() => {
    map?.remove();
    map = null;
  });
  const showMap = () => {
    map = document.createElement('div');
    map.setAttribute('data-tour-id', 'minimap');
    map.getBoundingClientRect = () =>
      ({ left: 16, top: 640, right: 272, bottom: 880, width: 256, height: 240 }) as DOMRect;
    document.body.append(map);
  };

  it('glides on to the fit clear of a Map that shows before the glide lands', () => {
    const { view, main, tab } = desktop();
    const plain = tabFitView(main, tab.elements)!;
    act(() => view.result.current.glideToFit(300));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    showMap();
    const clear = tabFitView(main, tab.elements)!;
    expect(clear).not.toEqual(plain);
    act(() => notifyMapShown());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const now = view.result.current.viewport.get();
    expect(now.zoom).toBeCloseTo(clear.zoom);
    expect(now.offset.x).toBeCloseTo(clear.offset.x);
    expect(now.offset.y).toBeCloseTo(clear.offset.y);
  });

  // A busy machine's glide frames trail its clock, so the Map's refit can land at once while a frame of the older
  // glide is still to come: that frame must not put back the fit made before the Map showed.
  it('keeps a fit made while a glide to the older fit is still on its way', () => {
    const { view, main, tab } = desktop();
    act(() => view.result.current.glideToFit(300));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    showMap();
    const clear = tabFitView(main, tab.elements)!;
    act(() => view.result.current.fitToScreen());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const now = view.result.current.viewport.get();
    expect(now.zoom).toBeCloseTo(clear.zoom);
    expect(now.offset.x).toBeCloseTo(clear.offset.x);
    expect(now.offset.y).toBeCloseTo(clear.offset.y);
  });

  it('leaves a view the person moved off a landed fit', () => {
    const { view } = desktop();
    act(() => view.result.current.glideToFit());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => view.result.current.setViewportOffset({ x: 999, y: 999 }));
    showMap();
    act(() => notifyMapShown());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(view.result.current.viewport.get().offset).toEqual({ x: 999, y: 999 });
  });
});
