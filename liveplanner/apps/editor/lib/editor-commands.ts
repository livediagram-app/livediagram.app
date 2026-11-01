// The contextual command catalogue for the SearchPanel "Actions" group
// (docs/specs/008-canvas/canvas-and-palette.md "Search panel"). A pure, handler-injected builder so the
// applicability logic (which commands apply to the current session and
// project) is unit-testable without React; `useEditorCommands` binds the
// handlers to the live editor and matching/capping happens in `lib/search.ts`.
//
// Every command maps 1:1 to an existing editor action (the same handler the
// context menu / toolbar / header calls), so behaviour + telemetry can't
// drift between entry points.

import type { CommandSearchItem } from './search';

// A runnable command: the searchable shape (id / name / keywords) plus the
// thunk the editor runs when it's picked.
export type EditorCommand = CommandSearchItem & { run: () => void };

// What the builder needs to know about the current editor to decide which
// commands apply. Kept primitive so the builder stays pure + cheap to test.
//
// Every command here does something on a Board, Sheet, Dashboard or Form tab. The diagram editor's canvas verbs
// (selection, tools, Fit to Screen, canvas options, layout cleanup, step numbers) are not offered: a Plan tab's
// content covers the canvas, so they would do nothing.
export type CommandContext = {
  // View-only session (docs/specs/007-editor/command-palette.md): only the view-safe subset (zen / export /
  // collaborators) is offered; every mutating command is withheld.
  isReadOnly: boolean;
  // Gate Undo / Redo on whether there's anything to un/redo.
  canUndo: boolean;
  canRedo: boolean;
  // Names the zen command honestly ("Enter" vs "Exit").
  zenMode: boolean;
  // The owner, or a joined member of a team project: the Share command is hidden for
  // visitors (one with an edit link gets "Make a copy" instead, which isn't a palette command).
  canShare: boolean;
  // Offline project (docs/specs/006-project/offline-mode.md): nothing on the server to share, so the Share
  // command is withheld even though the session counts as the owner's.
  isOffline: boolean;
  // The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table):
  // no ownership powers, so neither Share nor Delete project.
  workbench?: boolean;
};

// The handlers the commands call. Injected by useEditorCommands; each is the
// editor's existing action for that verb.
export type CommandHandlers = {
  createTab: () => void;
  renameProject: () => void;
  deleteProject: () => void;
  renameTab: () => void;
  openTheme: () => void;
  openShare: () => void;
  openCollaborators: () => void;
  undo: () => void;
  redo: () => void;
  toggleZen: () => void;
  openExport: () => void;
  openImport: () => void;
  // The Import dialog on Another Tool (docs/specs/026-plan/tracker-import.md "Where it lives").
  openTrackerImport: () => void;
  openSettings: () => void;
  openShortcuts: () => void;
};

export function buildEditorCommands(ctx: CommandContext, h: CommandHandlers): EditorCommand[] {
  // The view-safe subset (docs/specs/007-editor/command-palette.md): navigation / presentation verbs that
  // read-only visitors can run too. Everything below the read-only return
  // mutates the project (or opens an edit surface) and stays editor-only.
  const viewSafe: EditorCommand[] = [
    {
      id: 'zen',
      name: ctx.zenMode ? 'Exit zen mode' : 'Enter zen mode',
      keywords: 'zen focus distraction free full screen hide chrome presentation',
      run: h.toggleZen,
    },
    {
      id: 'export',
      name: 'Export…',
      keywords: 'export download png svg image markdown save file',
      run: h.openExport,
    },
    {
      // View-safe on purpose: it opens a panel and changes nothing, and a
      // view-only visitor has as much reason to ask who else is here as the
      // owner does. Not gated on the project being shared or on anyone else
      // being present either — "nobody yet" is a real answer to the question.
      id: 'collaborators',
      name: 'Collaborators',
      keywords:
        'collaborators people who is here participants presence roster online avatars session',
      run: h.openCollaborators,
    },
  ];
  if (ctx.isReadOnly) return viewSafe;

  const out: EditorCommand[] = [];

  // History. Offered only when there's actually something to un/redo, so
  // the palette never lists a dead verb.
  if (ctx.canUndo) {
    out.push({
      id: 'undo',
      name: 'Undo',
      keywords: 'undo revert back history mistake',
      run: h.undo,
    });
  }
  if (ctx.canRedo) {
    out.push({
      id: 'redo',
      name: 'Redo',
      keywords: 'redo repeat forward history',
      run: h.redo,
    });
  }

  // --- Project / tab commands. Always available in-project (independent of
  // the selection), so a power user can share / rename / theme without first
  // clearing what's selected.
  out.push({
    id: 'create-tab',
    name: 'Create New Tab',
    keywords: 'new tab create add page sheet board',
    run: h.createTab,
  });
  out.push({
    id: 'rename-tab',
    name: 'Rename Tab',
    keywords: 'rename tab title name relabel',
    run: h.renameTab,
  });
  out.push({
    id: 'rename-project',
    name: 'Rename Plan',
    keywords: 'rename project project title name relabel plan',
    run: h.renameProject,
  });
  if (!ctx.workbench) {
    out.push({
      id: 'delete-project',
      name: 'Delete Plan',
      keywords: 'delete project project remove trash destroy plan',
      run: h.deleteProject,
    });
  }
  out.push({
    id: 'open-theme',
    name: 'Open Theme',
    keywords: 'theme colour color scheme style appearance palette',
    run: h.openTheme,
  });
  if (ctx.canShare && !ctx.isOffline && !ctx.workbench) {
    out.push({
      id: 'share',
      name: 'Share Plan',
      keywords: 'share project project link invite collaborate publish embed export plan',
      run: h.openShare,
    });
  }

  // The app-level dialogs, then the view-safe verbs last so project commands keep the better ranks for
  // ambiguous queries.
  out.push({
    id: 'import',
    name: 'Import…',
    keywords: 'import markdown upload load open file',
    run: h.openImport,
  });
  out.push({
    id: 'import-tracker',
    name: 'Import from Another Tool…',
    keywords: 'import trello asana jira linear board export csv json move migrate',
    run: h.openTrackerImport,
  });
  out.push({
    id: 'settings',
    name: 'Open Settings',
    keywords: 'settings preferences options notifications',
    run: h.openSettings,
  });
  out.push({
    id: 'shortcuts',
    name: 'Keyboard Shortcuts',
    keywords: 'keyboard shortcuts keys hotkeys bindings cheatsheet',
    run: h.openShortcuts,
  });
  out.push(...viewSafe);

  return out;
}
