// The contextual command catalogue for the SearchPanel "Actions" group
// (docs/specs/008-canvas/canvas-and-palette.md "Search panel"). A pure, handler-injected builder so the
// applicability logic (which commands apply to the current selection /
// document) is unit-testable without React; `useEditorCommands` binds the
// handlers to the live editor and matching/capping happens in `lib/search.ts`.
//
// Every command maps 1:1 to an existing editor action (the same handler the
// context menu / toolbar / header calls), so behaviour + telemetry can't
// drift between entry points.

import type { ShapeMarker } from '@livehuddle/document';
import type { CommandSearchItem } from './search';
import { selectionCommands } from './editor-commands-selection';

// A runnable command: the searchable shape (id / name / keywords) plus the
// thunk the editor runs when it's picked.
export type EditorCommand = CommandSearchItem & { run: () => void };

// What the builder needs to know about the current editor to decide which
// commands apply. Kept primitive so the builder stays pure + cheap to test.
export type CommandContext = {
  // View-only session (docs/specs/007-editor/command-palette.md): only the view-safe subset (fit /
  // export) is offered; every mutating command is withheld.
  isReadOnly: boolean;
  // Gate Undo / Redo on whether there's anything to un/redo.
  canUndo: boolean;
  canRedo: boolean;
  // 0 = nothing selected, 1 = single selection, >1 = multi-selection.
  selectionCount: number;
  // True when the single selection is a boxed element (rotation / note /
  // comment / animation all target boxed elements; arrows are excluded).
  singleIsBoxed: boolean;
  // True when the single selection can be rotated (`supportsRotation`): boxed, minus an
  // annotation marker (docs/specs/009-elements/blueprints/annotations.md). Gates the Rotate commands.
  singleRotates: boolean;
  // True when the single selection is a plain shape (markers are shape-only).
  singleIsShape: boolean;
  // True when the single selection already carries a looping animation
  // (boxed `animation` or arrow `flow`) — gates "Clear animation".
  hasAnimation: boolean;
  // True when the tab holds a step number, so Renumber Steps has something to number.
  tabHasSteps?: boolean;
  // The single shape's current marker, or null — gates "Clear marker" and
  // hides the redundant "add <current marker>" entry.
  marker: ShapeMarker | null;
  // The owner, or a joined member of a team document: the Share command is hidden for
  // visitors (one with an edit link gets "Make a copy" instead, which isn't a palette command).
  canShare: boolean;
  // Offline document (docs/specs/006-document/offline-mode.md): nothing on the server to share, so the Share
  // command is withheld even though the session counts as the owner's.
  isOffline: boolean;
  // The editor in a workbench (livediagram/docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table; livehuddle no longer passes it):
  // no ownership powers, so neither Share nor Delete document.
  workbench?: boolean;
  // The canvas tool in force, so the command for the CURRENT side (Edit or Walk) is dropped.
  canvasTool: string;
  // A locked tab (docs/specs/008-canvas/canvas-and-palette.md "Locking") refuses every element edit, so search
  // offers none of them: no selection verbs, no layout cleanup.
  tabLocked?: boolean;
};

// The handlers the commands call. Injected by useEditorCommands; each is the
// editor's existing action for that verb.
export type CommandHandlers = {
  deleteSelection: () => void;
  duplicateSelection: () => void;
  toggleLockSelection: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  rotate: (deg: number) => void;
  clearAnimation: () => void;
  setMarker: (marker: ShapeMarker | null) => void;
  addComment: () => void;
  editNote: () => void;
  createTab: () => void;
  renameDocument: () => void;
  deleteDocument: () => void;
  renameTab: () => void;
  openTheme: () => void;
  openCanvasOptions: () => void;
  openShare: () => void;
  openCollaborators: () => void;
  undo: () => void;
  redo: () => void;
  fitToScreen: () => void;
  autoAlign: () => void;
  // Number every step on the tab 1, 2, 3 in reading order (docs/specs/009-elements/step-number.md).
  renumberSteps: () => void;
  openExport: () => void;
  openImport: () => void;
  openSettings: () => void;
  openShortcuts: () => void;
  // Switches the canvas tool — the same setter the palette's tool dropdown
  // calls, so the pressed state and telemetry are identical either way.
  setTool: (tool: string) => void;
};

// The two sides of the Edit | Walk toggle (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"), as Search
// offers them: the one not in force. Neither writes to the document, so both stay for a read-only Editor. There are no
// other tool commands: Hand, Eraser and Format Painter left with the Selection Mode picker (the Format Painter starts
// from the selection toolbar). A session held walking never gets Edit to work (useCanvasTool's hold refuses it).
export const CANVAS_TOOLS: { id: string; name: string; keywords: string }[] = [
  {
    id: 'select',
    name: 'Edit',
    keywords: 'edit build select pointer arrow cursor pick e v',
  },
  {
    id: 'avatar',
    name: 'Walk',
    keywords: 'walk walking avatar mode character person figure move around office room meet hop w',
  },
];

function toolCommands(ctx: CommandContext, h: CommandHandlers): EditorCommand[] {
  return CANVAS_TOOLS.filter((t) => t.id !== ctx.canvasTool).map((t) => ({
    id: `tool:${t.id}`,
    name: t.name,
    keywords: `tool mode switch ${t.keywords}`,
    run: () => h.setTool(t.id),
  }));
}

export function buildEditorCommands(ctx: CommandContext, h: CommandHandlers): EditorCommand[] {
  // The view-safe subset (docs/specs/007-editor/command-palette.md): navigation / presentation verbs that
  // read-only visitors can run too. Everything below the read-only return
  // mutates the document (or opens an edit surface) and stays editor-only.
  const viewSafe: EditorCommand[] = [
    {
      id: 'fit-to-screen',
      name: 'Fit to Screen',
      keywords: 'fit zoom overview centre center view all reset viewport',
      run: h.fitToScreen,
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
      // owner does. Not gated on the document being shared or on anyone else
      // being present either — "nobody yet" is a real answer to the question.
      id: 'collaborators',
      name: 'Collaborators',
      keywords:
        'collaborators people who is here participants presence roster online avatars following follow session',
      run: h.openCollaborators,
    },
    ...toolCommands(ctx, h),
  ];
  if (ctx.isReadOnly) return viewSafe;

  const out: EditorCommand[] = [];

  if (!ctx.tabLocked) out.push(...selectionCommands(ctx, h));

  // Walking (docs/specs/008-canvas/avatar-mode.md "No editing chrome while walking"): no history and no Tab Style.
  const walking = ctx.canvasTool === 'avatar';

  // History. Offered only when there's actually something to un/redo, so
  // the palette never lists a dead verb.
  if (ctx.canUndo && !walking) {
    out.push({
      id: 'undo',
      name: 'Undo',
      keywords: 'undo revert back history mistake',
      run: h.undo,
    });
  }
  if (ctx.canRedo && !walking) {
    out.push({
      id: 'redo',
      name: 'Redo',
      keywords: 'redo repeat forward history',
      run: h.redo,
    });
  }

  // --- Document / tab commands. Always available in-document (independent of
  // the selection), so someone at the keyboard can share / rename / theme without first
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
    id: 'rename-document',
    name: 'Rename Space',
    keywords: 'rename space canvas document diagram title name relabel',
    run: h.renameDocument,
  });
  if (!ctx.workbench) {
    out.push({
      id: 'delete-document',
      name: 'Delete Space',
      keywords: 'delete space canvas document diagram remove trash destroy',
      run: h.deleteDocument,
    });
  }
  if (!walking) {
    out.push({
      id: 'open-theme',
      name: 'Open Theme',
      keywords: 'theme colour color scheme style appearance palette',
      run: h.openTheme,
    });
    out.push({
      id: 'open-canvas',
      name: 'Open Canvas Options',
      keywords:
        'canvas background floor carpet wood tiles marble concrete grass sand options style backdrop',
      run: h.openCanvasOptions,
    });
  }
  if (ctx.canShare && !ctx.isOffline && !ctx.workbench) {
    out.push({
      id: 'share',
      name: 'Share Space',
      keywords: 'share space canvas document diagram link invite collaborate publish embed export',
      run: h.openShare,
    });
  }

  // Layout cleanup (docs/specs/008-canvas/layout-cleanup.md, here and nowhere else) + the app-level dialogs, then the
  // view-safe verbs last so selection / document commands keep the better
  // ranks for ambiguous queries.
  // Layout cleanup moves the tab's elements, so a locked tab offers none of it.
  if (!ctx.tabLocked) {
    out.push({
      id: 'auto-align',
      name: 'Auto-align to Grid',
      keywords: 'align grid snap straighten cleanup arrange tidy up layout',
      run: () => h.autoAlign(),
    });
    if (ctx.tabHasSteps) {
      out.push({
        id: 'renumber-steps',
        name: 'Renumber Steps',
        keywords:
          'renumber step steps number numbers order sequence walkthrough 1 2 3 reading order',
        run: h.renumberSteps,
      });
    }
  }
  out.push({
    id: 'import',
    name: 'Import…',
    keywords: 'import json upload load open file restore backup',
    run: h.openImport,
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
