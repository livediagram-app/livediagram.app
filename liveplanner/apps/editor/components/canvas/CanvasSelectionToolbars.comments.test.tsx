// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@liveplanner/project';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import type { CanvasProps } from './Canvas.types';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';

// docs/specs/026-plan/plan-mode.md "No comment thread on any canvas element" (Work Tracker 751): the selection
// toolbar offers no comment button to any role, on an element with a stored thread or without one.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

const bare = createShape('square', 100, 100);
const discussed = {
  ...createShape('square', 300, 100),
  commentThread: {
    resolved: false,
    comments: [
      { id: 'c1', text: 'Why here?', authorName: 'Ana', authorColor: '#123456', createdAt: 1 },
    ],
  },
} as unknown as Element;

function show(el: Element, takePart: boolean) {
  const props = {
    elements: [el],
    readOnly: true,
    takePart,
    canvasTool: 'select',
    onBeginEdit: vi.fn(),
  } as unknown as CanvasProps;
  const store = createSelectionStore();
  store.setSelectedId(el.id);
  render(
    <SelectionStoreProvider store={store}>
      <ViewportStoreProvider store={createViewportStore(1)}>
        <CanvasSelectionToolbars
          props={props}
          selectionInput={{
            elements: [el],
            editingId: null,
            tabLocked: false,
            readOnly: true,
          }}
          quickRingOpen={false}
        />
      </ViewportStoreProvider>
    </SelectionStoreProvider>,
  );
}

const button = (name: string) => screen.queryByRole('button', { name });

describe('the selection toolbar’s comment button', () => {
  it('is gone for a Participant, with or without a stored thread', () => {
    for (const el of [bare, discussed]) {
      show(el, true);
      expect(button('Add Comment')).toBeNull();
      expect(button('Show Comments')).toBeNull();
      cleanup();
    }
  });

  it('is gone for a Viewer, even on an element with comments', () => {
    for (const el of [bare, discussed]) {
      show(el, false);
      expect(button('Add Comment')).toBeNull();
      expect(button('Show Comments')).toBeNull();
      cleanup();
    }
  });
});
