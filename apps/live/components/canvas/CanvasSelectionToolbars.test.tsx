// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livediagram/document';
import {
  beginCanvasGesture,
  resetCanvasGesturesForTests,
  type CanvasGesture,
} from '@/lib/canvas-gesture';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import type { CanvasProps } from './Canvas.types';
import { createSelectionStore } from '@/lib/selection-store';
import { SelectionStoreProvider } from '@/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@/hooks/canvas/useViewportStore';
import { createViewportStore } from '@/lib/viewport-store';

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
        <CanvasSelectionToolbars
          props={props}
          selectionInput={selectionInput}
          quickRingOpen={false}
        />
      </ViewportStoreProvider>
    </SelectionStoreProvider>,
  );
}

// The wrapper that fades: the toolbar's transformed overlay.
const overlayOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[style*="visibility"]')!;

afterEach(() => resetCanvasGesturesForTests());

describe('selection chrome while a selection moves', () => {
  for (const multi of [false, true]) {
    const which = multi ? 'multi-selection toolbar' : 'selection popover';

    for (const kind of ['move', 'resize', 'reshape'] as CanvasGesture[]) {
      it(`hides the ${which} during a ${kind} and shows it after`, () => {
        const { container } = renderToolbars(multi);
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

    it(`keeps the ${which} during a pan`, () => {
      const { container } = renderToolbars(multi);
      act(() => {
        beginCanvasGesture('pan');
      });
      expect(overlayOf(container).style.visibility).toBe('visible');
    });
  }
});
