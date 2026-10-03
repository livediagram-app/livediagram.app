// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The search panel's command palette (docs/specs/007-editor/command-palette.md): the catalogue follows
// the editor's state, and a command runs the editor's action as it is when it runs.

let ctx: Record<string, unknown> = {};
vi.mock('@/app/document/[id]/EditorContext', () => ({ useEditorContext: () => ctx }));
vi.mock('@/hooks/persistence/useIsOfflineDocument', () => ({ useIsOfflineDocument: () => false }));
vi.mock('@/hooks/ui/useIsMobileViewport', () => ({ useIsMobileViewport: () => false }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { useEditorCommands } = await import('./useEditorCommands');

function editor(over: Record<string, unknown> = {}) {
  return {
    isReadOnly: false,
    isOwner: true,
    documentId: 'd1',
    selectedId: null,
    multiSelectedIds: new Set<string>(),
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
  it('offers Undo only while there is something to undo', () => {
    ctx = editor();
    const { result, rerender } = renderHook(() => useEditorCommands());
    expect(ids(result.current.commandItems)).toContain('undo');
    ctx = editor({ canUndo: false });
    rerender();
    expect(ids(result.current.commandItems)).not.toContain('undo');
  });

  it('keeps the catalogue while only the handlers change', () => {
    ctx = editor();
    const { result, rerender } = renderHook(() => useEditorCommands());
    const first = result.current.commandItems;
    ctx = editor({ undo: vi.fn() });
    rerender();
    expect(result.current.commandItems).toBe(first);
  });

  it('runs the editor action as it is now', () => {
    const first = vi.fn();
    const second = vi.fn();
    ctx = editor({ undo: first });
    const { result, rerender } = renderHook(() => useEditorCommands());
    ctx = editor({ undo: second });
    rerender();
    result.current.runCommand('undo');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  // docs/specs/007-editor/editor-modes.md: Draw mode has no format painter.
  it('follows the editor mode, not the tab', () => {
    ctx = editor({ editorMode: { mode: 'draw', setMode: vi.fn(), canSwitch: true } });
    const draw = ids(renderHook(() => useEditorCommands()).result.current.commandItems);
    expect(draw).not.toContain('tool:format');
    // Format needs content to paint, so the diagram side has some.
    const shape = { id: 's', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 };
    ctx = editor({ activeTab: { id: 't1', elements: [shape] } });
    const diagram = ids(renderHook(() => useEditorCommands()).result.current.commandItems);
    expect(diagram).toContain('tool:format');
  });
});
