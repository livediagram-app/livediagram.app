// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { presetSetup } from '@livediagram/items';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import type { CanvasProps } from './Canvas.types';
import { createSelectionStore } from '@/lib/selection-store';
import { SelectionStoreProvider } from '@/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@/hooks/canvas/useViewportStore';
import { createViewportStore } from '@/lib/viewport-store';

// docs/specs/008-canvas/canvas-and-palette.md: the selection toolbar keeps a wide gap only to clear the "+"
// quick-connect button; an element that shows none (a Plan board) gets the close gap.

const seen: { compact?: boolean }[] = [];
vi.mock('./SelectionPopover', () => ({
  SelectionPopover: (p: { compact?: boolean }) => {
    seen.push(p);
    return null;
  },
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

function compactFor(el: Element, readOnly = false): boolean | undefined {
  seen.length = 0;
  const store = createSelectionStore();
  store.setSelectedId(el.id);
  render(
    <SelectionStoreProvider store={store}>
      <ViewportStoreProvider store={createViewportStore(1)}>
        <CanvasSelectionToolbars
          props={{ elements: [el], readOnly, canvasTool: 'select' } as unknown as CanvasProps}
          selectionInput={{
            elements: [el],
            editingId: null,
            isPaintMode: false,
            tabLocked: false,
            readOnly,
          }}
          quickRingOpen={false}
        />
      </ViewportStoreProvider>
    </SelectionStoreProvider>,
  );
  return seen.at(-1)?.compact;
}

describe('selection toolbar gap', () => {
  it('sits close to a Plan board, which has no "+"', () => {
    const board = {
      ...createShape('plan-board', 0, 0),
      planBoard: presetSetup('kanban'),
    } as Element;
    expect(compactFor(board)).toBe(true);
  });

  it('clears the "+" on an ordinary shape, and sits close when read-only', () => {
    const square = createShape('square', 0, 0);
    expect(compactFor(square)).toBe(false);
    expect(compactFor(square, true)).toBe(true);
  });
});
