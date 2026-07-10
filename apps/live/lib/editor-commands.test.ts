import { describe, expect, it, vi } from 'vitest';
import { buildEditorCommands, type CommandContext, type CommandHandlers } from './editor-commands';

// A no-op handler set with spies, so a test can assert a command runs the
// handler it claims to.
function handlers(): CommandHandlers {
  return {
    deleteSelection: vi.fn(),
    duplicateSelection: vi.fn(),
    toggleLockSelection: vi.fn(),
    bringToFront: vi.fn(),
    sendToBack: vi.fn(),
    rotate: vi.fn(),
    clearAnimation: vi.fn(),
    setMarker: vi.fn(),
    addComment: vi.fn(),
    editNote: vi.fn(),
    createTab: vi.fn(),
    renameDiagram: vi.fn(),
    deleteDiagram: vi.fn(),
    renameTab: vi.fn(),
    openTheme: vi.fn(),
    openCanvasOptions: vi.fn(),
    openShare: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    toggleZen: vi.fn(),
    fitToScreen: vi.fn(),
    autoLayout: vi.fn(),
    autoAlign: vi.fn(),
    openExport: vi.fn(),
    openImport: vi.fn(),
    openSettings: vi.fn(),
    openShortcuts: vi.fn(),
    openTemplates: vi.fn(),
  };
}

const base: CommandContext = {
  isReadOnly: false,
  canUndo: false,
  canRedo: false,
  zenMode: false,
  selectionCount: 0,
  singleIsBoxed: false,
  singleIsShape: false,
  hasAnimation: false,
  marker: null,
  isOwner: true,
  isOffline: false,
};

const ids = (ctx: CommandContext) => buildEditorCommands(ctx, handlers()).map((c) => c.id);

describe('buildEditorCommands — diagram/tab commands', () => {
  it('always offers the in-diagram commands regardless of selection', () => {
    expect(ids(base)).toEqual(
      expect.arrayContaining([
        'create-tab',
        'rename-tab',
        'rename-diagram',
        'delete-diagram',
        'open-theme',
        'open-canvas',
        'share',
      ]),
    );
  });

  it('hides Share for non-owners', () => {
    expect(ids({ ...base, isOwner: false })).not.toContain('share');
  });

  it('hides Share for offline diagrams (spec/76)', () => {
    expect(ids({ ...base, isOffline: true })).not.toContain('share');
  });

  it('offers no selection commands when nothing is selected', () => {
    const out = ids(base);
    expect(out).not.toContain('delete');
    expect(out).not.toContain('bring-to-front');
    expect(out).not.toContain('rotate-90');
  });
});

describe('buildEditorCommands — selection commands', () => {
  it('offers delete/duplicate/lock/reorder for any selection (incl. multi)', () => {
    const out = ids({ ...base, selectionCount: 3 });
    expect(out).toEqual(
      expect.arrayContaining(['delete', 'duplicate', 'lock', 'bring-to-front', 'send-to-back']),
    );
    // Single-only commands stay hidden for a multi-selection.
    expect(out).not.toContain('rotate-90');
    expect(out).not.toContain('note');
  });

  it('ranks selection commands ahead of the diagram/tab commands', () => {
    const out = ids({ ...base, selectionCount: 1, singleIsBoxed: true });
    expect(out.indexOf('delete')).toBeLessThan(out.indexOf('create-tab'));
  });

  it('offers rotate/note/comment for a single boxed element', () => {
    const out = ids({ ...base, selectionCount: 1, singleIsBoxed: true });
    expect(out).toEqual(
      expect.arrayContaining([
        'rotate-90',
        'rotate-180',
        'rotate-270',
        'rotate-0',
        'note',
        'comment',
      ]),
    );
  });

  it('does not offer boxed-only commands for a single arrow (not boxed)', () => {
    const out = ids({ ...base, selectionCount: 1, singleIsBoxed: false });
    expect(out).not.toContain('rotate-90');
    expect(out).not.toContain('note');
  });

  it('offers Clear animation only when the element is animated', () => {
    expect(ids({ ...base, selectionCount: 1, singleIsBoxed: true })).not.toContain(
      'clear-animation',
    );
    expect(ids({ ...base, selectionCount: 1, singleIsBoxed: true, hasAnimation: true })).toContain(
      'clear-animation',
    );
  });
});

describe('buildEditorCommands — markers (shape only)', () => {
  const shape = { ...base, selectionCount: 1, singleIsBoxed: true, singleIsShape: true };

  it('offers the marker catalogue and no Clear marker when none is set', () => {
    const out = ids(shape);
    expect(out).not.toContain('clear-marker');
    expect(out).toContain('marker-green-circle');
    expect(out).toContain('marker-checkbox-checked');
  });

  it('offers Clear marker and hides the current marker when one is set', () => {
    const out = ids({ ...shape, marker: 'green-circle' });
    expect(out).toContain('clear-marker');
    expect(out).not.toContain('marker-green-circle');
    expect(out).toContain('marker-red-circle');
  });

  it('does not offer markers for a non-shape boxed element', () => {
    const out = ids({ ...base, selectionCount: 1, singleIsBoxed: true, singleIsShape: false });
    expect(out.some((id) => id.startsWith('marker-'))).toBe(false);
  });
});

describe('buildEditorCommands — dispatch', () => {
  it('runs the matching handler, including the rotation angle', () => {
    const h = handlers();
    const cmds = buildEditorCommands({ ...base, selectionCount: 1, singleIsBoxed: true }, h);
    cmds.find((c) => c.id === 'rotate-180')!.run();
    expect(h.rotate).toHaveBeenCalledWith(180);

    cmds.find((c) => c.id === 'delete')!.run();
    expect(h.deleteSelection).toHaveBeenCalledOnce();
  });

  it('Clear marker dispatches setMarker(null)', () => {
    const h = handlers();
    const cmds = buildEditorCommands(
      {
        ...base,
        selectionCount: 1,
        singleIsBoxed: true,
        singleIsShape: true,
        marker: 'red-circle',
      },
      h,
    );
    cmds.find((c) => c.id === 'clear-marker')!.run();
    expect(h.setMarker).toHaveBeenCalledWith(null);
  });
});

// Spec/70: the app-level command palette expansion.
describe('buildEditorCommands — app-level commands (spec/70)', () => {
  it('offers view / cleanup / dialog commands for editors', () => {
    expect(ids(base)).toEqual(
      expect.arrayContaining([
        'zen',
        'fit-to-screen',
        'export',
        'auto-layout',
        'auto-align',
        'import',
        'browse-templates',
        'settings',
        'shortcuts',
      ]),
    );
  });

  it('offers Undo / Redo only when there is history to walk', () => {
    expect(ids(base)).not.toContain('undo');
    expect(ids(base)).not.toContain('redo');
    expect(ids({ ...base, canUndo: true })).toContain('undo');
    expect(ids({ ...base, canRedo: true })).toContain('redo');
  });

  it('read-only sessions get exactly the view-safe subset', () => {
    expect(ids({ ...base, isReadOnly: true })).toEqual(['zen', 'fit-to-screen', 'export']);
  });

  it('names the zen command by its direction', () => {
    const name = (zen: boolean) =>
      buildEditorCommands({ ...base, zenMode: zen }, handlers()).find((c) => c.id === 'zen')!.name;
    expect(name(false)).toBe('Enter zen mode');
    expect(name(true)).toBe('Exit zen mode');
  });

  it('dispatches the app-level handlers', () => {
    const h = handlers();
    const cmds = buildEditorCommands({ ...base, canUndo: true, canRedo: true }, h);
    cmds.find((c) => c.id === 'undo')!.run();
    cmds.find((c) => c.id === 'auto-layout')!.run();
    cmds.find((c) => c.id === 'export')!.run();
    expect(h.undo).toHaveBeenCalledOnce();
    expect(h.autoLayout).toHaveBeenCalledOnce();
    expect(h.openExport).toHaveBeenCalledOnce();
  });

  // Spec/47 "Layout styles": one command per explicit style, each passing
  // its choice through to the shared autoLayout handler.
  it('offers a command per layout style and passes the choice through', () => {
    const h = handlers();
    const cmds = buildEditorCommands(base, h);
    for (const styleId of ['flow-down', 'flow-right', 'tree', 'mindmap'] as const) {
      cmds.find((c) => c.id === `auto-layout-${styleId}`)!.run();
      expect(h.autoLayout).toHaveBeenLastCalledWith(styleId);
    }
    // The plain command stays the smart default (no explicit choice).
    cmds.find((c) => c.id === 'auto-layout')!.run();
    expect(h.autoLayout).toHaveBeenLastCalledWith();
  });

  it('withholds the layout style commands from read-only sessions', () => {
    expect(ids({ ...base, isReadOnly: true })).not.toContain('auto-layout-mindmap');
  });
});
