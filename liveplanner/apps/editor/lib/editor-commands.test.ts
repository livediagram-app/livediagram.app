import { describe, expect, it, vi } from 'vitest';
import { buildEditorCommands, type CommandContext, type CommandHandlers } from './editor-commands';

// A no-op handler set with spies, so a test can assert a command runs the
// handler it claims to.
function handlers(): CommandHandlers {
  return {
    createTab: vi.fn(),
    renameProject: vi.fn(),
    deleteProject: vi.fn(),
    renameTab: vi.fn(),
    openTheme: vi.fn(),
    openShare: vi.fn(),
    openCollaborators: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    toggleZen: vi.fn(),
    openExport: vi.fn(),
    openImport: vi.fn(),
    openTrackerImport: vi.fn(),
    openSettings: vi.fn(),
    openShortcuts: vi.fn(),
  };
}

const base: CommandContext = {
  isReadOnly: false,
  canUndo: false,
  canRedo: false,
  zenMode: false,
  canShare: true,
  isOffline: false,
};

const ids = (ctx: CommandContext) => buildEditorCommands(ctx, handlers()).map((c) => c.id);

describe('buildEditorCommands — project/tab commands', () => {
  it('always offers the in-project commands', () => {
    expect(ids(base)).toEqual(
      expect.arrayContaining([
        'create-tab',
        'rename-tab',
        'rename-project',
        'delete-project',
        'open-theme',
        'share',
      ]),
    );
  });

  it('hides Share for non-owners', () => {
    expect(ids({ ...base, canShare: false })).not.toContain('share');
  });

  it('hides Share for offline projects (docs/specs/006-project/offline-mode.md)', () => {
    expect(ids({ ...base, isOffline: true })).not.toContain('share');
  });
});

// The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table).
describe('buildEditorCommands — in a workbench', () => {
  it('offers neither Share nor Delete project, and keeps the rest', () => {
    const inWorkbench = ids({ ...base, canShare: true, workbench: true });
    expect(inWorkbench).not.toContain('share');
    expect(inWorkbench).not.toContain('delete-project');
    expect(inWorkbench).toContain('rename-project');
    expect(ids({ ...base, canShare: true })).toEqual(
      expect.arrayContaining(['share', 'delete-project']),
    );
  });
});

// A Plan tab's content covers the canvas, so the diagram editor's canvas verbs would do nothing there.
describe('buildEditorCommands — Plan tabs', () => {
  it('offers exactly the commands that act on a Board, Sheet, Dashboard or Form tab', () => {
    expect(ids({ ...base, canUndo: true, canRedo: true }).sort()).toEqual(
      [
        'undo',
        'redo',
        'create-tab',
        'rename-tab',
        'rename-project',
        'delete-project',
        'open-theme',
        'share',
        'import',
        'import-tracker',
        'settings',
        'shortcuts',
        'zen',
        'export',
        'collaborators',
      ].sort(),
    );
  });

  it('offers no canvas, selection, tool or layout command', () => {
    const out = ids({ ...base, canUndo: true, canRedo: true });
    for (const gone of [
      'delete',
      'duplicate',
      'lock',
      'fit-to-screen',
      'open-canvas',
      'auto-layout',
      'auto-align',
      'renumber-steps',
      'tool:select',
      'tool:isometric',
    ])
      expect(out).not.toContain(gone);
    expect(out.some((id) => id.startsWith('auto-layout') || id.startsWith('tool:'))).toBe(false);
  });
});

describe('buildEditorCommands — app-level commands (docs/specs/007-editor/command-palette.md)', () => {
  it('offers Undo / Redo only when there is history to walk', () => {
    expect(ids(base)).not.toContain('undo');
    expect(ids(base)).not.toContain('redo');
    expect(ids({ ...base, canUndo: true })).toContain('undo');
    expect(ids({ ...base, canRedo: true })).toContain('redo');
  });

  it('read-only sessions get exactly the view-safe subset', () => {
    // Nothing here writes to the project, which is the property this test exists to hold.
    expect(ids({ ...base, isReadOnly: true })).toEqual(['zen', 'export', 'collaborators']);
  });

  it('offers Collaborators to everyone, shared or not, owner or not', () => {
    for (const over of [
      {},
      { canShare: false },
      { isOffline: true },
      { isReadOnly: true },
    ] as Partial<CommandContext>[]) {
      expect(ids({ ...base, ...over })).toContain('collaborators');
    }
  });

  it('names the zen command by its direction', () => {
    const name = (zen: boolean) =>
      buildEditorCommands({ ...base, zenMode: zen }, handlers()).find((c) => c.id === 'zen')!.name;
    expect(name(false)).toBe('Enter zen mode');
    expect(name(true)).toBe('Exit zen mode');
  });

  it('dispatches the handlers', () => {
    const h = handlers();
    const cmds = buildEditorCommands({ ...base, canUndo: true, canRedo: true }, h);
    const run = (id: string) => cmds.find((c) => c.id === id)!.run();
    run('undo');
    run('export');
    run('collaborators');
    run('shortcuts');
    // A board from another tool: an Editor's alone, read-only sessions never see it (above).
    run('import-tracker');
    expect(h.openTrackerImport).toHaveBeenCalledOnce();
    expect(h.undo).toHaveBeenCalledOnce();
    expect(h.openExport).toHaveBeenCalledOnce();
    expect(h.openCollaborators).toHaveBeenCalledOnce();
    expect(h.openShortcuts).toHaveBeenCalledOnce();
  });
});
