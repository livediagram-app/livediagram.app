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
  };
}

const base: CommandContext = {
  selectionCount: 0,
  singleIsBoxed: false,
  singleIsShape: false,
  hasAnimation: false,
  marker: null,
  isOwner: true,
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
