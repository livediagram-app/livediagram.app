// The contextual command catalogue for the SearchPanel "Actions" group
// (spec/09 "Search panel"). A pure, handler-injected builder so the
// applicability logic (which commands apply to the current selection /
// diagram) is unit-testable without React; `useEditorCommands` binds the
// handlers to the live editor and matching/capping happens in `lib/search.ts`.
//
// Every command maps 1:1 to an existing editor action (the same handler the
// context menu / toolbar / header calls), so behaviour + telemetry can't
// drift between entry points.

import { SHAPE_MARKERS, type ShapeMarker } from '@livediagram/diagram';
import type { CommandSearchItem } from './search';

// A runnable command: the searchable shape (id / name / keywords) plus the
// thunk the editor runs when it's picked.
export type EditorCommand = CommandSearchItem & { run: () => void };

// What the builder needs to know about the current editor to decide which
// commands apply. Kept primitive so the builder stays pure + cheap to test.
export type CommandContext = {
  // View-only session (spec/70): only the view-safe subset (zen / fit /
  // export) is offered; every mutating command is withheld.
  isReadOnly: boolean;
  // Gate Undo / Redo on whether there's anything to un/redo.
  canUndo: boolean;
  canRedo: boolean;
  // Names the zen command honestly ("Enter" vs "Exit").
  zenMode: boolean;
  // 0 = nothing selected, 1 = single selection, >1 = multi-selection.
  selectionCount: number;
  // True when the single selection is a boxed element (rotation / note /
  // comment / animation all target boxed elements; arrows are excluded).
  singleIsBoxed: boolean;
  // True when the single selection is a plain shape (markers are shape-only).
  singleIsShape: boolean;
  // True when the single selection already carries a looping animation
  // (boxed `animation` or arrow `flow`) — gates "Clear animation".
  hasAnimation: boolean;
  // The single shape's current marker, or null — gates "Clear marker" and
  // hides the redundant "add <current marker>" entry.
  marker: ShapeMarker | null;
  // Owner-only: the Share command is hidden for non-owners (a visitor with
  // an edit link gets "Make a copy" instead, which isn't a palette command).
  isOwner: boolean;
  // Offline diagram (spec/76): nothing on the server to share, so the Share
  // command is withheld even though the session counts as the owner's.
  isOffline: boolean;
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
  renameDiagram: () => void;
  deleteDiagram: () => void;
  renameTab: () => void;
  openTheme: () => void;
  openCanvasOptions: () => void;
  openShare: () => void;
  undo: () => void;
  redo: () => void;
  toggleZen: () => void;
  fitToScreen: () => void;
  autoLayout: () => void;
  autoAlign: () => void;
  openExport: () => void;
  openImport: () => void;
  openSettings: () => void;
  openShortcuts: () => void;
  openTemplates: () => void;
};

// Human-readable marker names for the "Add … marker" commands. The raw ids
// ('green-circle', 'checkbox-checked', ...) aren't search-friendly.
const MARKER_LABEL: Record<ShapeMarker, string> = {
  'green-circle': 'green status',
  'orange-circle': 'amber status',
  'red-circle': 'red status',
  'checkbox-unchecked': 'unchecked box',
  'checkbox-checked': 'checked box',
};

export function buildEditorCommands(ctx: CommandContext, h: CommandHandlers): EditorCommand[] {
  // The view-safe subset (spec/70): navigation / presentation verbs that
  // read-only visitors can run too. Everything below the read-only return
  // mutates the diagram (or opens an edit surface) and stays editor-only.
  const viewSafe: EditorCommand[] = [
    {
      id: 'zen',
      name: ctx.zenMode ? 'Exit zen mode' : 'Enter zen mode',
      keywords: 'zen focus distraction free full screen hide chrome presentation',
      run: h.toggleZen,
    },
    {
      id: 'fit-to-screen',
      name: 'Fit to screen',
      keywords: 'fit zoom overview centre center view all reset viewport',
      run: h.fitToScreen,
    },
    {
      id: 'export',
      name: 'Export…',
      keywords: 'export download png svg image markdown save file',
      run: h.openExport,
    },
  ];
  if (ctx.isReadOnly) return viewSafe;

  const out: EditorCommand[] = [];
  const hasSelection = ctx.selectionCount > 0;
  const isSingle = ctx.selectionCount === 1;

  // --- Selection commands. Ranked first so they stay in context with what's
  // selected. Delete / Duplicate / Lock / reorder work for single + multi.
  if (hasSelection) {
    out.push({
      id: 'delete',
      name: 'Delete selection',
      keywords: 'delete remove erase clear',
      run: h.deleteSelection,
    });
    out.push({
      id: 'duplicate',
      name: 'Duplicate selection',
      keywords: 'duplicate copy clone',
      run: h.duplicateSelection,
    });
    out.push({
      id: 'lock',
      name: 'Lock / unlock selection',
      keywords: 'lock unlock freeze protect',
      run: h.toggleLockSelection,
    });
    out.push({
      id: 'bring-to-front',
      name: 'Bring to front',
      keywords: 'front forward top raise order layer z-index arrange',
      run: h.bringToFront,
    });
    out.push({
      id: 'send-to-back',
      name: 'Send to back',
      keywords: 'back backward bottom lower order layer z-index arrange',
      run: h.sendToBack,
    });
  }

  // Rotation / note / comment / animation are single boxed-element actions.
  if (isSingle && ctx.singleIsBoxed) {
    for (const deg of [90, 180, 270] as const) {
      out.push({
        id: `rotate-${deg}`,
        name: `Rotate ${deg}°`,
        keywords: 'rotate turn spin angle rotation orientation',
        run: () => h.rotate(deg),
      });
    }
    out.push({
      id: 'rotate-0',
      name: 'Reset rotation',
      keywords: 'rotate reset clear angle rotation straighten upright 0',
      run: () => h.rotate(0),
    });
    out.push({
      id: 'note',
      name: 'Add / edit note',
      keywords: 'note annotate memo description',
      run: h.editNote,
    });
    out.push({
      id: 'comment',
      name: 'Add comment',
      keywords: 'comment discuss feedback thread reply',
      run: h.addComment,
    });
  }

  // Clear animation works for any single animated element — a boxed
  // `animation` or an arrow's `flow` (so it sits outside the boxed-only
  // block above). Offered only when the element actually has one.
  if (isSingle && ctx.hasAnimation) {
    out.push({
      id: 'clear-animation',
      name: 'Clear animation',
      keywords: 'animation animate clear remove stop motion flow',
      run: h.clearAnimation,
    });
  }

  // Markers are shape-only: clear the current one (if any), then offer the
  // rest of the catalogue.
  if (isSingle && ctx.singleIsShape) {
    if (ctx.marker) {
      out.push({
        id: 'clear-marker',
        name: 'Clear marker',
        keywords: 'marker status dot badge clear remove none',
        run: () => h.setMarker(null),
      });
    }
    for (const m of SHAPE_MARKERS) {
      if (m === ctx.marker) continue;
      out.push({
        id: `marker-${m}`,
        name: `Add ${MARKER_LABEL[m]} marker`,
        keywords: `marker status dot badge add ${m}`,
        run: () => h.setMarker(m),
      });
    }
  }

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

  // --- Diagram / tab commands. Always available in-diagram (independent of
  // the selection), so a power user can share / rename / theme without first
  // clearing what's selected.
  out.push({
    id: 'create-tab',
    name: 'Create new tab',
    keywords: 'new tab create add page sheet board',
    run: h.createTab,
  });
  out.push({
    id: 'rename-tab',
    name: 'Rename tab',
    keywords: 'rename tab title name relabel',
    run: h.renameTab,
  });
  out.push({
    id: 'rename-diagram',
    name: 'Rename diagram',
    keywords: 'rename diagram title name relabel',
    run: h.renameDiagram,
  });
  out.push({
    id: 'delete-diagram',
    name: 'Delete diagram',
    keywords: 'delete diagram remove trash destroy',
    run: h.deleteDiagram,
  });
  out.push({
    id: 'open-theme',
    name: 'Open theme',
    keywords: 'theme colour color scheme style appearance palette',
    run: h.openTheme,
  });
  out.push({
    id: 'open-canvas',
    name: 'Open canvas options',
    keywords: 'canvas background pattern grid options style backdrop',
    run: h.openCanvasOptions,
  });
  if (ctx.isOwner && !ctx.isOffline) {
    out.push({
      id: 'share',
      name: 'Share diagram',
      keywords: 'share link invite collaborate publish embed export',
      run: h.openShare,
    });
  }

  // Cleanup (spec/47's tab-menu band) + the app-level dialogs, then the
  // view-safe verbs last so selection / diagram commands keep the better
  // ranks for ambiguous queries.
  out.push({
    id: 'auto-layout',
    name: 'Auto Layout (tidy up)',
    keywords: 'auto layout tidy arrange clean cleanup organise organize graph',
    run: h.autoLayout,
  });
  out.push({
    id: 'auto-align',
    name: 'Auto-align to grid',
    keywords: 'align grid snap straighten cleanup arrange',
    run: h.autoAlign,
  });
  out.push({
    id: 'import',
    name: 'Import…',
    keywords: 'import markdown upload load open file',
    run: h.openImport,
  });
  out.push({
    id: 'browse-templates',
    name: 'Browse templates',
    keywords: 'template quick start starter scaffold gallery',
    run: h.openTemplates,
  });
  out.push({
    id: 'settings',
    name: 'Open settings',
    keywords: 'settings preferences options notifications',
    run: h.openSettings,
  });
  out.push({
    id: 'shortcuts',
    name: 'Keyboard shortcuts',
    keywords: 'keyboard shortcuts keys hotkeys bindings cheatsheet',
    run: h.openShortcuts,
  });
  out.push(...viewSafe);

  return out;
}
