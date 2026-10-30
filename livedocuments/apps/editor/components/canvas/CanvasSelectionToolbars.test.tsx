// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livedocuments/document';
import {
  beginCanvasGesture,
  resetCanvasGesturesForTests,
  type CanvasGesture,
} from '@/lib/canvas-gesture';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import type { CanvasProps } from './Canvas.types';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';

// docs/specs/008-canvas/canvas-performance.md: the selection chrome is hidden while a selection is
// moved, resized or reshaped, and comes back when the gesture ends.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const shape = createShape('square', 100, 100);
const other = createShape('square', 300, 100);

function renderToolbars(multi: boolean) {
  const elements = [shape, other];
  const props = {
    elements,
    readOnly: false,
    canvasTool: 'select',
    onDuplicateSelected: vi.fn(),
    onToggleLockSelected: vi.fn(),
    onDeleteSelected: vi.fn(),
    onOpenComments: vi.fn(),
    onBeginEdit: vi.fn(),
  } as unknown as CanvasProps;
  const store = createSelectionStore();
  if (multi) store.setMultiSelectedIds(new Set([shape.id, other.id]));
  else store.setSelectedId(shape.id);
  const selectionInput = {
    elements,
    editingId: null,
    isPaintMode: false,
    tabLocked: false,
    readOnly: false,
  };
  return render(
    <SelectionStoreProvider store={store}>
      <ViewportStoreProvider store={createViewportStore(1)}>
        <CanvasSelectionToolbars props={props} selectionInput={selectionInput} />
      </ViewportStoreProvider>
    </SelectionStoreProvider>,
  );
}

// The wrapper that fades: the toolbar's transformed overlay.
const overlayOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[style*="visibility"]')!;

afterEach(() => resetCanvasGesturesForTests());

describe('the multi-selection toolbar while a selection moves', () => {
  for (const kind of ['move', 'resize', 'reshape'] as CanvasGesture[]) {
    it(`hides during a ${kind} and shows after`, () => {
      const { container } = renderToolbars(true);
      expect(overlayOf(container).style.visibility).toBe('visible');
      let end = () => {};
      act(() => {
        end = beginCanvasGesture(kind);
      });
      expect(overlayOf(container).style.visibility).toBe('hidden');
      act(() => end());
      expect(overlayOf(container).style.visibility).toBe('visible');
    });
  }

  it('stays during a pan', () => {
    const { container } = renderToolbars(true);
    act(() => {
      beginCanvasGesture('pan');
    });
    expect(overlayOf(container).style.visibility).toBe('visible');
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Selection popover": a single selected element has no toolbar in
// livedocuments, for any role; its actions are in the element menu.
describe('a single selection', () => {
  it('draws no toolbar over the element', () => {
    const { container } = renderToolbars(false);
    expect(container.querySelector('[role="toolbar"]')).toBeNull();
    expect(container.innerHTML).toBe('');
  });
});
