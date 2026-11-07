// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livehuddle/document';
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

function renderToolbars(multi: boolean, over: Partial<CanvasProps> = {}) {
  const elements = over.elements ?? [shape, other];
  const [first, second] = elements;
  const readOnly = over.readOnly ?? false;
  const props = {
    elements,
    readOnly,
    canvasTool: 'select',
    onDuplicateSelected: vi.fn(),
    onDeleteSelected: vi.fn(),
    onOpenComments: vi.fn(),
    onBeginEdit: vi.fn(),
    ...over,
  } as unknown as CanvasProps;
  const store = createSelectionStore();
  if (multi) store.setMultiSelectedIds(new Set([first!.id, second!.id]));
  else store.setSelectedId(first!.id);
  const selectionInput = {
    elements,
    editingId: null,
    isPaintMode: false,
    readOnly,
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

afterEach(() => {
  cleanup();
  resetCanvasGesturesForTests();
});

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

// docs/specs/008-canvas/canvas-and-palette.md "Format painter": the selection toolbar's Format Painter is its one way
// in, loaded with the selected element, an Editor's alone.
describe('the Format Painter button', () => {
  it('starts the painter with the selected element', () => {
    const onStartFormatPainter = vi.fn();
    renderToolbars(false, { onStartFormatPainter });
    fireEvent.click(screen.getByRole('button', { name: 'Format Painter' }));
    expect(onStartFormatPainter).toHaveBeenCalledWith(shape.id);
  });

  it('is not offered read-only', () => {
    renderToolbars(false, { readOnly: true, onStartFormatPainter: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Format Painter' })).toBeNull();
  });
});

// docs/specs/009-elements/furniture-facing.md "Turning a placed piece".
describe('the Rotate buttons', () => {
  const sofa = createShape('sofa', 100, 100);
  const plant = createShape('plant', 400, 100);

  it('turn a selected piece of furniture a quarter either way', () => {
    const onTurnSelected = vi.fn();
    renderToolbars(false, { elements: [sofa, plant], onTurnSelected });
    fireEvent.click(screen.getByRole('button', { name: 'Rotate Left' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rotate Right' }));
    expect(onTurnSelected.mock.calls).toEqual([[-1], [1]]);
  });

  it('stay live on a piece saved locked before locking left', () => {
    renderToolbars(false, {
      elements: [{ ...sofa, locked: true } as typeof sofa, plant],
      onTurnSelected: vi.fn(),
    });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Rotate Left' }).disabled).toBe(
      false,
    );
  });

  it('are not offered for a piece that does not turn, or read-only', () => {
    renderToolbars(false, { elements: [plant, sofa], onTurnSelected: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Rotate Left' })).toBeNull();
    cleanup();
    renderToolbars(false, { elements: [sofa, plant], onTurnSelected: vi.fn(), readOnly: true });
    expect(screen.queryByRole('button', { name: 'Rotate Left' })).toBeNull();
  });

  it('turn a multi-selection holding a piece that turns', () => {
    const onTurnSelected = vi.fn();
    renderToolbars(true, { elements: [plant, sofa], onTurnSelected });
    fireEvent.click(screen.getByRole('button', { name: 'Rotate Right' }));
    expect(onTurnSelected).toHaveBeenCalledWith(1);
    cleanup();
    renderToolbars(true, { elements: [shape, plant], onTurnSelected });
    expect(screen.queryByRole('button', { name: 'Rotate Right' })).toBeNull();
  });
});
