// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livehuddle/document';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';
import { useElementSelectionActions as buildSelectionActions } from '@/hooks/canvas/useElementSelectionActions';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import type { CanvasProps } from './Canvas.types';

// docs/specs/002-project-scope/not-in-livehuddle.md "Deleting it": a retired element's card shows its own Delete
// only when it is big enough on screen, so on a phone at its Fit zoom (or any card too small) the selection
// toolbar's Delete is how an Editor removes it. A Participant or a Viewer (read-only) gets no Delete.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

const pie = {
  id: 'pie',
  type: 'shape',
  shape: 'pie-chart',
  x: 100,
  y: 100,
  width: 320,
  height: 220,
  label: '',
  pieSlices: [{ label: 'Yes', value: 3 }],
} as unknown as Element;
const keep = { ...pie, id: 'keep', shape: 'rating', x: 600 } as unknown as Element;

function renderToolbars(readOnly: boolean, onDeleteSelected: () => void) {
  const elements = [pie, keep];
  const props = {
    elements,
    readOnly,
    canvasTool: 'select',
    onDuplicateSelected: vi.fn(),
    onDeleteSelected,
    onOpenComments: vi.fn(),
    onBeginEdit: vi.fn(),
  } as unknown as CanvasProps;
  const store = createSelectionStore();
  store.setSelectedId('pie');
  return render(
    <SelectionStoreProvider store={store}>
      <ViewportStoreProvider store={createViewportStore(0.25)}>
        <CanvasSelectionToolbars
          props={props}
          selectionInput={{ elements, editingId: null, isPaintMode: false, readOnly }}
        />
      </ViewportStoreProvider>
    </SelectionStoreProvider>,
  );
}

describe("the selection toolbar's Delete on a retired element", () => {
  it('removes it for an Editor, with the same removal as the Delete key', () => {
    let after: Element[] | null = null;
    const selection = new Set(['pie']);
    const actions = buildSelectionActions({
      currentSelectionIds: () => selection,
      readSelection: () => ({ selectedId: 'pie', multiSelectedIds: new Set<string>() }),
      activeTab: { id: 't', name: 'T', elements: [pie, keep] },
      commit: (map) => {
        after = map([pie, keep]);
      },
      setSelectedId: () => {},
      setEditingId: () => {},
      setMultiSelectedIds: () => {},
      setFormatSourceId: () => {},
      lockedByOther: () => false,
    });
    renderToolbars(false, actions.deleteSelected);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(after).toEqual([keep]);
  });

  it('is not offered to a Participant or a Viewer (read-only)', () => {
    const onDelete = vi.fn();
    renderToolbars(true, onDelete);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
