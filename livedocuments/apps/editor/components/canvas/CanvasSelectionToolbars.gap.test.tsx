// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livedocuments/document';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import type { CanvasProps } from './Canvas.types';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';

// docs/specs/008-canvas/canvas-and-palette.md: the selection toolbar keeps a wide gap only to clear the "+"
// quick-connect button; an element that shows none gets the close gap.

const seen: { compact?: boolean; aside?: unknown }[] = [];
vi.mock('./SelectionPopover', () => ({
  SelectionPopover: (p: { compact?: boolean; aside?: unknown }) => {
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
  it('clears the "+" on an ordinary shape, and sits close when read-only', () => {
    const square = createShape('square', 0, 0);
    expect(compactFor(square)).toBe(false);
    expect(compactFor(square, true)).toBe(true);
  });

  it('keeps the wide gap on an arrow, whose move frame sits in it', () => {
    const arrow = {
      id: 'ar',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 200, y: 0 },
    } as Element;
    expect(compactFor(arrow)).toBe(false);
  });
});
