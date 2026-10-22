// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type Element } from '@livedesign/document';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import type { CanvasProps } from './Canvas.types';
import { createSelectionStore } from '@/lib/selection-store';
import { SelectionStoreProvider } from '@/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@/hooks/canvas/useViewportStore';
import { createViewportStore } from '@/lib/viewport-store';

// docs/specs/013-workspace/share-roles.md: a Participant comments; a Viewer writes no comment, so it reads the thread
// an element has behind Show Comments and is offered nothing on an element with none.

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
    onOpenComments: vi.fn(),
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
  it('lets a Participant add a comment anywhere', () => {
    show(bare, true);
    expect(button('Add Comment')).not.toBeNull();
  });

  it('offers a Viewer only the comments there are, to read', () => {
    show(bare, false);
    expect(button('Add Comment')).toBeNull();
    expect(button('Show Comments')).toBeNull();
    cleanup();
    show(discussed, false);
    expect(button('Add Comment')).toBeNull();
    expect(button('Show Comments')).not.toBeNull();
  });
});
