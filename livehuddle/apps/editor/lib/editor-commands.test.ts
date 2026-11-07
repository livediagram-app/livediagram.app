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
    turn: vi.fn(),
    clearAnimation: vi.fn(),
    renumberSteps: vi.fn(),
    setMarker: vi.fn(),
    addComment: vi.fn(),
    editNote: vi.fn(),
    createTab: vi.fn(),
    renameDocument: vi.fn(),
    deleteDocument: vi.fn(),
    renameTab: vi.fn(),
    openTheme: vi.fn(),
    openCanvasOptions: vi.fn(),
    openShare: vi.fn(),
    openCollaborators: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    fitToScreen: vi.fn(),
    autoAlign: vi.fn(),
    openExport: vi.fn(),
    openImport: vi.fn(),
    openSettings: vi.fn(),
    openShortcuts: vi.fn(),
    setTool: vi.fn(),
  };
}

const base: CommandContext = {
  isReadOnly: false,
  canUndo: false,
  canRedo: false,
  selectionCount: 0,
  singleIsBoxed: false,
  singleRotates: false,
  singleIsShape: false,
  hasAnimation: false,
  marker: null,
  canShare: true,
  isOffline: false,
  // A drawn-on desktop canvas in Select, which is where most of these
  // assertions live; the tool commands have their own describe block.
  canvasTool: 'select',
};

const ids = (ctx: CommandContext) => buildEditorCommands(ctx, handlers()).map((c) => c.id);

describe('buildEditorCommands — document/tab commands', () => {
  it('always offers the in-document commands regardless of selection', () => {
    expect(ids(base)).toEqual(
      expect.arrayContaining([
        'create-tab',
        'rename-tab',
        'rename-document',
        'delete-document',
        'open-theme',
        'open-canvas',
        'share',
      ]),
    );
  });

  it('hides Share for non-owners', () => {
    expect(ids({ ...base, canShare: false })).not.toContain('share');
  });

  it('hides Share for offline documents (docs/specs/006-document/offline-mode.md)', () => {
    expect(ids({ ...base, isOffline: true })).not.toContain('share');
  });

  it('offers no selection commands when nothing is selected', () => {
    const out = ids(base);
    expect(out).not.toContain('delete');
    expect(out).not.toContain('bring-to-front');
    expect(out).not.toContain('rotate-90');
  });
});

// The editor in a workbench (livediagram/docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table).
describe('buildEditorCommands — in a workbench', () => {
  it('offers neither Share nor Delete document, and keeps the rest', () => {
    const inWorkbench = ids({ ...base, canShare: true, workbench: true });
    expect(inWorkbench).not.toContain('share');
    expect(inWorkbench).not.toContain('delete-document');
    expect(inWorkbench).toContain('rename-document');
    expect(ids({ ...base, canShare: true })).toEqual(
      expect.arrayContaining(['share', 'delete-document']),
    );
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

  it('ranks selection commands ahead of the document/tab commands', () => {
    const out = ids({ ...base, selectionCount: 1, singleIsBoxed: true });
    expect(out.indexOf('delete')).toBeLessThan(out.indexOf('create-tab'));
  });

  it('offers rotate/note/comment for a single boxed element', () => {
    const out = ids({ ...base, selectionCount: 1, singleIsBoxed: true, singleRotates: true });
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

  // docs/specs/009-elements/blueprints/annotations.md [QD8]: an annotation marker never rotates.
  it('offers note and comment but no Rotate for an annotation marker', () => {
    const out = ids({ ...base, selectionCount: 1, singleIsBoxed: true, singleRotates: false });
    expect(out).toEqual(expect.arrayContaining(['note', 'comment']));
    expect(out).not.toContain('rotate-90');
    expect(out).not.toContain('rotate-0');
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
    const cmds = buildEditorCommands(
      { ...base, selectionCount: 1, singleIsBoxed: true, singleRotates: true },
      h,
    );
    cmds.find((c) => c.id === 'rotate-180')!.run();
    expect(h.rotate).toHaveBeenCalledWith(180);

    cmds.find((c) => c.id === 'delete')!.run();
    expect(h.deleteSelection).toHaveBeenCalledOnce();
  });

  it('turns furniture a quarter either way (docs/specs/009-elements/furniture-facing.md)', () => {
    const h = handlers();
    expect(ids({ ...base, selectionCount: 1, singleIsBoxed: true })).not.toContain('rotate-left');
    const cmds = buildEditorCommands({ ...base, selectionCount: 2, selectionTurns: true }, h);
    cmds.find((c) => c.id === 'rotate-left')!.run();
    cmds.find((c) => c.id === 'rotate-right')!.run();
    expect(vi.mocked(h.turn).mock.calls).toEqual([[-1], [1]]);
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

// docs/specs/007-editor/command-palette.md: the app-level command palette expansion.
describe('buildEditorCommands — app-level commands (docs/specs/007-editor/command-palette.md)', () => {
  it('offers view / cleanup / dialog commands for editors', () => {
    expect(ids(base)).toEqual(
      expect.arrayContaining([
        'fit-to-screen',
        'export',
        'auto-align',
        'import',
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

  // docs/specs/008-canvas/avatar-mode.md "No editing chrome while walking".
  it('offers no Undo, Redo or Tab Style while walking, and brings them back after', () => {
    const history = { ...base, canUndo: true, canRedo: true };
    const walking = ids({ ...history, canvasTool: 'avatar' });
    for (const id of ['undo', 'redo', 'open-theme', 'open-canvas'])
      expect(walking).not.toContain(id);
    expect(walking).toContain('share');
    expect(ids(history)).toEqual(
      expect.arrayContaining(['undo', 'redo', 'open-theme', 'open-canvas']),
    );
  });

  it('read-only sessions get exactly the view-safe subset', () => {
    // The three view verbs plus the side of the Edit | Walk toggle not in force. Nothing here writes to the
    // document, which is the property this test exists to hold: every command below the read-only return is
    // withheld.
    expect(ids({ ...base, isReadOnly: true })).toEqual([
      'fit-to-screen',
      'export',
      // Reads the room, writes nothing: a viewer may ask who else is here.
      'collaborators',
      // Walking writes nothing (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle").
      'tool:avatar',
    ]);
  });

  it('offers Collaborators to everyone, shared or not, owner or not', () => {
    // The panel answers "who is in this document" — a question that is just as
    // valid alone, on someone else's link, or on an offline document.
    for (const over of [
      {},
      { canShare: false },
      { isOffline: true },
      { isReadOnly: true },
    ] as Partial<CommandContext>[]) {
      expect(ids({ ...base, ...over })).toContain('collaborators');
    }
  });

  it('runs the collaborators handler', () => {
    const h = handlers();
    buildEditorCommands(base, h)
      .find((c) => c.id === 'collaborators')!
      .run();
    expect(h.openCollaborators).toHaveBeenCalledOnce();
  });

  it('dispatches the app-level handlers', () => {
    const h = handlers();
    const cmds = buildEditorCommands({ ...base, canUndo: true, canRedo: true }, h);
    cmds.find((c) => c.id === 'undo')!.run();
    cmds.find((c) => c.id === 'auto-align')!.run();
    cmds.find((c) => c.id === 'export')!.run();
    expect(h.undo).toHaveBeenCalledOnce();
    expect(h.autoAlign).toHaveBeenCalledOnce();
    expect(h.openExport).toHaveBeenCalledOnce();
  });

  // Auto Layout left livehuddle (Work Tracker #423, part 4): only Auto-align tidies the tab.
  it('offers no Auto Layout command', () => {
    expect(ids(base).some((id) => id.startsWith('auto-layout'))).toBe(false);
  });
});

// The Edit | Walk toggle's two sides as Search offers them (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk
// toggle"): the one not in force. Hand, Eraser and Format Painter are not commands (Format Painter starts from the
// selection toolbar).
describe('canvas tool commands', () => {
  it('offers Walk while editing and Edit while walking', () => {
    expect(ids(base).filter((id) => id.startsWith('tool:'))).toEqual(['tool:avatar']);
    expect(ids({ ...base, canvasTool: 'avatar' }).filter((id) => id.startsWith('tool:'))).toEqual([
      'tool:select',
    ]);
  });

  it('names them Edit and Walk', () => {
    const name = (ctx: CommandContext, id: string) =>
      buildEditorCommands(ctx, handlers()).find((c) => c.id === id)?.name;
    expect(name(base, 'tool:avatar')).toBe('Walk');
    expect(name({ ...base, canvasTool: 'avatar' }, 'tool:select')).toBe('Edit');
  });

  it('runs the tool setter with the tool id', () => {
    const h = handlers();
    buildEditorCommands(base, h)
      .find((c) => c.id === 'tool:avatar')!
      .run();
    expect(h.setTool).toHaveBeenCalledWith('avatar');
  });

  it('offers no Hand, Eraser or Format Painter command', () => {
    for (const tool of ['select', 'avatar', 'pan', 'format']) {
      const got = ids({ ...base, canvasTool: tool });
      for (const id of ['tool:pan', 'tool:eraser', 'tool:format']) expect(got).not.toContain(id);
    }
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "The presenting tools, Isometric and Zen".
  it('offers no Laser, Spotlight, Isometric or Zen command', () => {
    for (const id of ['tool:laser', 'tool:spotlight', 'tool:isometric', 'zen'])
      expect(ids(base)).not.toContain(id);
  });

  // livehuddle has no Slide Deck (docs/specs/002-project-scope/not-in-livehuddle.md, Work Tracker #423 part 2).
  it('offers no Slide Deck command', () => {
    expect(ids(base)).not.toContain('tool:slide-deck');
  });

  // docs/specs/008-canvas/highlighter.md "Not a selection mode": the marker is a Draw tile.
  it('never offers the highlighter as a tool', () => {
    expect(ids(base)).not.toContain('tool:highlighter');
  });

  it('gives a read-only visitor both sides, as neither writes', () => {
    expect(ids({ ...base, isReadOnly: true })).toContain('tool:avatar');
    expect(ids({ ...base, isReadOnly: true, canvasTool: 'avatar' })).toContain('tool:select');
  });
});

// docs/specs/009-elements/step-number.md: Renumber Steps in the command palette, for an editor on a tab with steps.
describe('buildEditorCommands — Renumber Steps', () => {
  it('offers it only when the tab holds a step, and never read-only or on a locked tab', () => {
    expect(ids(base)).not.toContain('renumber-steps');
    expect(ids({ ...base, tabHasSteps: true })).toContain('renumber-steps');
    expect(ids({ ...base, tabHasSteps: true, isReadOnly: true })).not.toContain('renumber-steps');
    expect(ids({ ...base, tabHasSteps: true, tabLocked: true })).not.toContain('renumber-steps');
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Locking": a locked tab refuses every element edit, so search
// offers none.
describe('buildEditorCommands — locked tab', () => {
  it('offers no element edits or layout cleanup on a locked tab', () => {
    const got = ids({ ...base, tabLocked: true, selectionCount: 1, singleIsBoxed: true });
    expect(got).not.toContain('delete');
    expect(got).not.toContain('duplicate');
    expect(got.some((id) => id.startsWith('auto-layout'))).toBe(false);
    expect(got).not.toContain('auto-align');
    // The document and the view stay workable.
    expect(got).toEqual(expect.arrayContaining(['create-tab', 'rename-document', 'fit-to-screen']));
  });

  it('keeps them on an unlocked tab', () => {
    const got = ids({ ...base, selectionCount: 1, singleIsBoxed: true });
    expect(got).toEqual(expect.arrayContaining(['auto-align']));
  });

  it('offers Walk on a locked tab, read-only or not, but not while walking (avatar-mode.md)', () => {
    expect(ids({ ...base, tabLocked: true })).toContain('tool:avatar');
    expect(ids({ ...base, tabLocked: true, isReadOnly: true })).toContain('tool:avatar');
    expect(ids({ ...base, canvasTool: 'avatar' })).not.toContain('tool:avatar');
  });
});
