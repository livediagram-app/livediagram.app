// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// The search panel's command palette (docs/specs/007-editor/command-palette.md): the catalogue follows
// the editor's state, and a command runs the editor's action as it is when it runs.

let ctx: Record<string, unknown> = {};
vi.mock('@/app/project/[id]/EditorContext', () => ({ useEditorContext: () => ctx }));
vi.mock('@/hooks/persistence/useIsOfflineProject', () => ({ useIsOfflineProject: () => false }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => false,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const { useEditorCommands } = await import('./useEditorCommands');

const run = () => renderHook(() => useEditorCommands());

function editor(over: Record<string, unknown> = {}) {
  return {
    isReadOnly: false,
    canShareProject: true,
    projectId: 'd1',
    activeTab: { id: 't1', elements: [] },
    canUndo: true,
    canRedo: false,
    zenMode: false,
    canvasTool: 'select',
    photoImportAvailable: false,
    undo: vi.fn(),
    redo: vi.fn(),
    ...over,
  };
}

const ids = (items: { id: string }[] | undefined) => (items ?? []).map((i) => i.id);

describe('useEditorCommands', () => {
  // A Plan tab's content covers the canvas: no selection, tool or layout command, even with a selection.
  it('offers no canvas commands', () => {
    const shape = { id: 's', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 };
    ctx = editor({ activeTab: { id: 't1', elements: [shape] } });
    const out = ids(run().result.current.commandItems);
    for (const gone of ['delete', 'fit-to-screen', 'open-canvas', 'auto-layout', 'tool:format'])
      expect(out).not.toContain(gone);
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
});
