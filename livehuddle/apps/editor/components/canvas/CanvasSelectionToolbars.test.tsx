// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livehuddle/document';
import {
  beginCanvasGesture,
  resetCanvasGesturesForTests,
  type CanvasGesture,
} from '@liveworkspace/workbench/lib/canvas-gesture';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import type { CanvasProps } from './Canvas.types';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';

// docs/specs/008-canvas/canvas-performance.md: the selection chrome is hidden while a selection is
// moved, resized or reshaped, and comes back when the gesture ends.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const shape = createShape('focus-button', 100, 100);
const other = createShape('focus-button', 300, 100);

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
    onBeginEdit: vi.fn(),
    ...over,
  } as unknown as CanvasProps;
  const store = createSelectionStore();
  if (multi) store.setMultiSelectedIds(new Set([first!.id, second!.id]));
  else store.setSelectedId(first!.id);
  const selectionInput = {
    elements,
    editingId: null,
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

// docs/specs/002-project-scope/not-in-livehuddle.md "Format Painter and Clear Styles": no Format Painter on the
// toolbar, and a retired element takes no typed label.
describe('no Format Painter', () => {
  it('is not offered, nor Add Text on a retired element', () => {
    const qa = { ...shape, id: 'qa', shape: 'qa-board' } as unknown as typeof shape;
    renderToolbars(false, { elements: [qa, other] });
    expect(screen.queryByRole('button', { name: 'Format Painter' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Add Text|Edit Text/ })).toBeNull();
  });
});

// docs/specs/002-project-scope/not-in-livehuddle.md "Element looks, layers, opacity and rotation": neither toolbar
// turns or restacks anything, on a piece that turns or not; a piece turns from its menu section and Search.
describe('no turn or stacking buttons', () => {
  const sofa = createShape('sofa', 100, 100);
  const plant = createShape('plant', 400, 100);
  const GONE = ['Rotate Left', 'Rotate Right', 'Bring to Front', 'Send to Back'];

  for (const multi of [false, true]) {
    it(`on the ${multi ? 'multi-selection toolbar' : 'selection popover'} over a piece that turns`, () => {
      renderToolbars(multi, { elements: [sofa, plant], onOpenElementContextMenu: vi.fn() });
      for (const name of GONE) expect(screen.queryByRole('button', { name })).toBeNull();
      // What stays is still there.
      expect(screen.getAllByRole('button', { name: /Duplicate/ }).length).toBeGreaterThan(0);
    });
  }

  it('leaves the single toolbar with More, Duplicate and Delete', () => {
    renderToolbars(false, { elements: [sofa, plant], onOpenElementContextMenu: vi.fn() });
    const names = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names).toEqual(['More actions', 'Duplicate', 'Delete']);
  });
});

// docs/specs/009-elements/poster.md "Choosing its picture": a selected Poster's toolbar carries Choose Picture (Change
// once it has one) for an Editor alone; it opens the image picker for that poster.
describe("a Poster's picture button", () => {
  const poster = { ...createShape('poster', 100, 100), id: 'p' };
  const context = (posterPicker: boolean, onOpenPicker = vi.fn()) => ({
    imageContext: { ownerId: 'u', documentId: 'd', shareCode: null, onOpenPicker, posterPicker },
  });

  it('is offered to an Editor and opens the picker for the poster', () => {
    const onOpenPicker = vi.fn();
    renderToolbars(false, { elements: [poster], ...context(true, onOpenPicker) });
    act(() => screen.getByRole('button', { name: 'Choose Picture' }).click());
    expect(onOpenPicker).toHaveBeenCalledWith('p');
  });

  it('says Change once the poster has a picture', () => {
    renderToolbars(false, {
      elements: [{ ...poster, imageId: 'img_a' }],
      ...context(true),
    });
    expect(screen.getByRole('button', { name: 'Change Picture' })).toBeTruthy();
  });

  it('is not offered to a Participant or a Viewer, nor on any other piece', () => {
    renderToolbars(false, { elements: [poster], ...context(false) });
    expect(screen.queryByRole('button', { name: 'Choose Picture' })).toBeNull();
    cleanup();
    renderToolbars(false, { elements: [poster], readOnly: true, ...context(true) });
    expect(screen.queryByRole('button', { name: 'Choose Picture' })).toBeNull();
    cleanup();
    renderToolbars(false, { elements: [shape], ...context(true) });
    expect(screen.queryByRole('button', { name: 'Choose Picture' })).toBeNull();
  });
});
