// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@livediagram/document';
import { LibraryProvider } from '@liveworkspace/workbench/components/library/LibraryProvider';
import type { LibraryApi } from '@liveworkspace/workbench/lib/library/library-api';
import { CanvasSelectionToolbars } from './CanvasSelectionToolbars';
import { ElementKindToolButtons, useElementKindTools } from './element-kind-tools';
import type { CanvasProps } from './Canvas.types';
import { createSelectionStore } from '@liveworkspace/workbench/lib/selection-store';
import { SelectionStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useSelectionStore';
import { ViewportStoreProvider } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import { createViewportStore } from '@liveworkspace/workbench/lib/viewport-store';

// Save to Library (liveworkspace/docs/specs/006-media/libraries.md "Who may do what"): the selection toolbar publishes
// it to the element menu's bar (element-kind-tools), never a button of its own. An Editor's alone
// (docs/specs/013-workspace/share-roles.md): a Participant's and a Viewer's menus never carry it, and an editor without
// the Library shows none.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
afterEach(cleanup);

const box = createShape('square', 100, 100);
const api = {
  list: vi.fn(async () => ({
    items: [],
    teams: [],
    hidden: 0,
    legacy: { unavailable: [], copied: [], writable: true },
  })),
} as unknown as LibraryApi;

function show({
  readOnly,
  takePart = false,
  library = true,
}: {
  readOnly: boolean;
  takePart?: boolean;
  library?: boolean;
}) {
  const props = {
    elements: [box],
    readOnly,
    takePart,
    canvasTool: 'select',
    onOpenComments: vi.fn(),
    onBeginEdit: vi.fn(),
    onDuplicateSelected: vi.fn(),
    onToggleLockSelected: vi.fn(),
    onDeleteSelected: vi.fn(),
  } as unknown as CanvasProps;
  const store = createSelectionStore();
  store.setSelectedId(box.id);
  const toolbars = (
    <SelectionStoreProvider store={store}>
      <ViewportStoreProvider store={createViewportStore(1)}>
        <CanvasSelectionToolbars
          props={props}
          selectionInput={{
            elements: [box],
            editingId: null,
            isPaintMode: false,
            tabLocked: false,
            readOnly,
          }}
          quickRingOpen={false}
        />
      </ViewportStoreProvider>
    </SelectionStoreProvider>
  );
  const withBar = (
    <>
      {toolbars}
      <MenuBar />
    </>
  );
  render(library ? <LibraryProvider api={api}>{withBar}</LibraryProvider> : withBar);
}

// The element menu's bar, as it reads what the toolbar published.
function MenuBar() {
  const tools = useElementKindTools(box.id);
  return tools ? <ElementKindToolButtons tools={tools} /> : null;
}

const save = () => screen.queryByRole('button', { name: 'Save to Library' });

describe('Save to Library on the selection toolbar', () => {
  it('is an Editor’s, in the element menu’s bar', () => {
    show({ readOnly: false });
    expect(save()).not.toBeNull();
  });

  it('is never a Participant’s or a Viewer’s', () => {
    show({ readOnly: true, takePart: true });
    expect(save()).toBeNull();
    cleanup();
    show({ readOnly: true });
    expect(save()).toBeNull();
  });

  it('is not offered without the Library', () => {
    show({ readOnly: false, library: false });
    expect(save()).toBeNull();
  });
});
