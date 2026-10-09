// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The search panel's command palette (docs/specs/007-editor/command-palette.md): the catalogue follows
// the editor's state, and a command runs the editor's action as it is when it runs.

let ctx: Record<string, unknown> = {};
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({ useIsOfflineDocument: () => false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => false }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { useEditorCommands } = await import('./useEditorCommands');
const { createSelectionStore } = await import('@/lib/selection-store');
const { SelectionStoreProvider } = await import('./useSelectionStore');

// The commands read the selection from the store while search is open.
let store = createSelectionStore();
const wrapper = ({ children }: { children: ReactNode }) => (
  <SelectionStoreProvider store={store}>{children}</SelectionStoreProvider>
);
const run = (open = true) => {
  store = createSelectionStore();
  return renderHook(() => useEditorCommands(open), { wrapper });
};

function editor(over: Record<string, unknown> = {}) {
  return {
    isReadOnly: false,
    isOwner: true,
    canCombine: () => false,
    combineSelected: vi.fn(),
    documentId: 'd1',
    activeTab: { id: 't1', elements: [] },
    editorMode: { mode: 'diagram', setMode: vi.fn(), canSwitch: true },
    canUndo: true,
    canRedo: false,
    zenMode: false,
    canvasTool: 'select',
    esBoard: false,
    photoImportAvailable: false,
    undo: vi.fn(),
    redo: vi.fn(),
    ...over,
  };
}

const ids = (items: { id: string }[] | undefined) => (items ?? []).map((i) => i.id);

describe('useEditorCommands', () => {
  it('offers the selection commands once something is selected, while search is open', () => {
    ctx = editor();
    const { result } = run();
    expect(ids(result.current.commandItems)).not.toContain('delete');
    act(() => store.setMultiSelectedIds(new Set(['a', 'b'])));
    expect(ids(result.current.commandItems)).toContain('delete');
  });

  it('does not follow the selection while search is closed', () => {
    ctx = editor();
    let renders = 0;
    store = createSelectionStore();
    renderHook(
      () => {
        renders += 1;
        return useEditorCommands(false);
      },
      { wrapper },
    );
    const before = renders;
    act(() => store.setSelectedId('a'));
    expect(renders).toBe(before);
  });

  it('offers Undo only while there is something to undo', () => {
    ctx = editor();
    const { result, rerender } = run();
    expect(ids(result.current.commandItems)).toContain('undo');
    ctx = editor({ canUndo: false });
    rerender();
    expect(ids(result.current.commandItems)).not.toContain('undo');
  });

  it('keeps the catalogue while only the handlers change', () => {
    ctx = editor();
    const { result, rerender } = run();
    const first = result.current.commandItems;
    ctx = editor({ undo: vi.fn() });
    rerender();
    expect(result.current.commandItems).toBe(first);
  });

  it('runs the editor action as it is now', () => {
    const first = vi.fn();
    const second = vi.fn();
    ctx = editor({ undo: first });
    const { result, rerender } = run();
    ctx = editor({ undo: second });
    rerender();
    result.current.runCommand('undo');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  // docs/specs/007-editor/editor-modes.md: Draw mode has no format painter.
  it('follows the editor mode, not the tab', () => {
    ctx = editor({ editorMode: { mode: 'draw', setMode: vi.fn(), canSwitch: true } });
    const draw = ids(run().result.current.commandItems);
    expect(draw).not.toContain('tool:format');
    // Format needs content to paint, so the diagram side has some.
    const shape = { id: 's', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 };
    ctx = editor({ activeTab: { id: 't1', elements: [shape] } });
    const diagram = ids(run().result.current.commandItems);
    expect(diagram).toContain('tool:format');
  });
});
