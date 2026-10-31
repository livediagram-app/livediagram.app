// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { layOutPages, pageScreenRect, type Element } from '@livedesign/design';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { InspectOverlay, keepPillOnScreen, sizePillAt } from './InspectOverlay';

// docs/specs/007-editor/wireframe-pages.md "The measurements on the canvas".
const pages = layOutPages([
  { id: 'p1', kind: 'wireframe', device: 'iphone', size: 'device' },
] as never);
const scr = pageScreenRect(pages[0]!);
const box = (id: string, y: number) =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: scr.x + 16,
    y: scr.y + y,
    width: 120,
    height: 44,
  }) as unknown as Element;
const elements = [box('a', 100), box('b', 164)];

function Harness({ store }: { store: ReturnType<typeof createSelectionStore> }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  return (
    <SelectionStoreProvider store={store}>
      <ViewportStoreProvider store={createViewportStore(1)}>
        <div ref={wrapperRef} data-testid="wrapper">
          {elements.map((el) => (
            <div key={el.id} data-element-id={el.id} data-testid={el.id} />
          ))}
        </div>
        <InspectOverlay
          elements={elements}
          pages={pages}
          wrapperRef={wrapperRef}
          mainSize={{ width: 800, height: 600 }}
        />
      </ViewportStoreProvider>
    </SelectionStoreProvider>
  );
}

const overlay = () => document.querySelector('[data-inspect-overlay]');
const pills = () =>
  [...document.querySelectorAll('[data-inspect-overlay] text')].map((t) => t.textContent);
const hover = (id: string) =>
  act(() => {
    document
      .querySelector(`[data-testid="${id}"]`)!
      .dispatchEvent(new Event('pointermove', { bubbles: true }));
  });

afterEach(cleanup);

describe('Inspect on the canvas', () => {
  it('draws nothing with nothing selected or hovered', () => {
    render(<Harness store={createSelectionStore()} />);
    expect(overlay()).toBeNull();
  });

  it('outlines the selected element with its size and its spacing round it', () => {
    const store = createSelectionStore();
    store.setSelectedId('a');
    render(<Harness store={store} />);
    expect(overlay()).not.toBeNull();
    expect(pills()).toContain('120 × 44');
    expect(pills()).toContain('20');
    expect(pills()).toContain('16');
  });

  it('measures between the selected and the hovered, and drops it on leaving', () => {
    const store = createSelectionStore();
    store.setSelectedId('a');
    render(<Harness store={store} />);
    hover('b');
    expect(pills()).toEqual(expect.arrayContaining(['120 × 44', '20']));
    expect(pills()).not.toContain('16');
    act(() => {
      document.querySelector('[data-testid="wrapper"]')!.dispatchEvent(new Event('pointerleave'));
    });
    expect(pills()).toContain('16');
  });

  it('measures round the hovered element with nothing selected', () => {
    render(<Harness store={createSelectionStore()} />);
    hover('b');
    expect(overlay()).not.toBeNull();
    expect(pills()).toContain('20');
  });
});

describe('the size pill', () => {
  const b = { x: 100, y: 100, w: 200, h: 40 };
  it('sits below the element, above it when a line runs down, beside its corner when lines run both ways', () => {
    expect(sizePillAt(b, 80, new Set(['left']))).toEqual({ x: 160, y: 146 });
    expect(sizePillAt(b, 80, new Set(['bottom']))).toEqual({ x: 160, y: 76 });
    expect(sizePillAt(b, 80, new Set(['top', 'bottom']))).toEqual({ x: 306, y: 146 });
  });

  it('keeps the size pill and the distance pills inside the canvas, below the palette', () => {
    // A phone zoomed in on a full-width element put the pill past the window's edge (round 1 saw it clipped).
    const view = { left: 0, top: 124, right: 390, bottom: 796 };
    const wide = { x: -40, y: 300, w: 470, h: 80 };
    expect(sizePillAt(wide, 64, new Set(['top', 'bottom']), view)).toEqual({ x: 318, y: 386 });
    expect(sizePillAt({ x: 100, y: -200, w: 80, h: 60 }, 64, new Set(['bottom']), view)).toEqual({
      x: 108,
      y: 132,
    });
    expect(keepPillOnScreen({ x: -30, y: 900 }, 40, view)).toEqual({ x: 8, y: 770 });
    expect(keepPillOnScreen({ x: 100, y: 300 }, 40, view)).toEqual({ x: 100, y: 300 });
  });
});
