// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createShape,
  packFreehandPoints,
  pathOfContours,
  type Element,
  type PathAnchor,
} from '@livedesign/design';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import type { CanvasProps } from './Canvas.types';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { EditorContext } from '@/app/design/[id]/EditorContext';

// docs/specs/023-draw-mode/path-tool.md "Combined paths" and "Freehand strokes": Edit Points on a
// combined path, and on a stroke (tidied into a path first).

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

const corner = (x: number, y: number): PathAnchor => ({ x, y, mode: 'corner' });
const combined = pathOfContours({ id: 'ring', type: 'path', closed: true }, [
  [corner(0, 0), corner(100, 0), corner(100, 100), corner(0, 100)],
  [corner(25, 25), corner(75, 25), corner(75, 75)],
]);
const stroke: Element = {
  id: 'stroke',
  type: 'freehand',
  closed: false,
  ...packFreehandPoints(Array.from({ length: 12 }, (_, i) => ({ x: i * 10, y: Math.sin(i) }))),
};
const highlight = { ...stroke, id: 'hi', pen: 'highlighter' } as Element;

function renderFor(el: Element, tidied = true) {
  const onBeginEdit = vi.fn();
  const tidyUpSelected = vi.fn(() => tidied);
  const props = {
    elements: [el, createShape('square', 300, 100)],
    readOnly: false,
    canvasTool: 'select',
    onBeginEdit,
    onCancelDraw: vi.fn(),
  } as unknown as CanvasProps;
  const store = createSelectionStore();
  store.setSelectedId(el.id);
  render(
    <EditorContext.Provider value={{ tidyUpSelected } as never}>
      <SelectionStoreProvider store={store}>
        <ViewportStoreProvider store={createViewportStore(1)}>
          <CanvasSelectionToolbars
            props={props}
            selectionInput={{
              elements: props.elements,
              editingId: null,
              isPaintMode: false,
              tabLocked: false,
              readOnly: false,
            }}
            quickRingOpen={false}
          />
        </ViewportStoreProvider>
      </SelectionStoreProvider>
    </EditorContext.Provider>,
  );
  return { onBeginEdit, tidyUpSelected };
}

const editPoints = () => screen.queryByRole('button', { name: /^Edit Points/ });

describe('Edit Points beyond a drawn path', () => {
  it('opens a combined path’s points', () => {
    const s = renderFor(combined);
    fireEvent.click(editPoints()!);
    expect(s.onBeginEdit).toHaveBeenCalledWith('ring');
    expect(s.tidyUpSelected).not.toHaveBeenCalled();
  });

  it('tidies a stroke into a path, then opens it', () => {
    const s = renderFor(stroke);
    fireEvent.click(editPoints()!);
    expect(s.tidyUpSelected).toHaveBeenCalled();
    expect(s.onBeginEdit).toHaveBeenCalledWith('stroke');
  });

  it('opens nothing when the tidy made nothing', () => {
    const s = renderFor(stroke, false);
    fireEvent.click(editPoints()!);
    expect(s.onBeginEdit).not.toHaveBeenCalled();
  });

  it('is not offered on a stroke Tidy cannot take', () => {
    renderFor(highlight);
    expect(editPoints()).toBeNull();
  });
});
