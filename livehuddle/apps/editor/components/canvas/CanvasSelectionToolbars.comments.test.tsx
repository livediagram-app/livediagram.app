// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSticky, type Element } from '@livehuddle/document';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import type { CanvasProps } from './Canvas.types';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';

// docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes": no role adds or reads a
// comment from the selection toolbar, so a Participant and a Viewer, whose only button it was, get no toolbar.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

const bare = createSticky(100, 100);
const discussed = {
  ...createSticky(300, 100),
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
            isPaintMode: false,
            readOnly: true,
          }}
        />
      </ViewportStoreProvider>
    </SelectionStoreProvider>,
  );
}

const button = (name: string) => screen.queryByRole('button', { name });

describe('the selection toolbar for a Participant or a Viewer', () => {
  it('offers no comment button, even on an element with a stored thread', () => {
    for (const takePart of [true, false])
      for (const el of [bare, discussed]) {
        show(el, takePart);
        expect(button('Add Comment')).toBeNull();
        expect(button('Show Comments')).toBeNull();
        expect(screen.queryByTestId('selection-popover')).toBeNull();
        cleanup();
      }
  });
});
