// The contextual command catalogue for the SearchPanel "Actions" group
// (spec/09 "Search panel"). A pure, handler-injected builder so the
// applicability logic (which commands apply to the current selection /
// diagram) is unit-testable without React; `useEditorCommands` binds the
// handlers to the live editor and matching/capping happens in `lib/search.ts`.
//
// Every command maps 1:1 to an existing editor action (the same handler the
// context menu / toolbar / header calls), so behaviour + telemetry can't
// drift between entry points.

import {
  AUTO_LAYOUT_CHOICES,
  AUTO_LAYOUT_STYLE_IDS,
  type AutoLayoutChoice,
} from './auto-layout-choices';
import type { ShapeMarker } from '@livediagram/diagram';
import type { CommandSearchItem } from './search';
import { selectionCommands } from './editor-commands-selection';

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
  // The canvas tool in force, so the command for the CURRENT tool is dropped
  // (offering "Hand tool" while holding the hand does nothing).
  canvasTool: string;
  // Nothing drawn yet. Every tool but Select and Hand acts on existing
  // content, so they disable on an empty canvas exactly as the palette's
  // tool dropdown disables them.
  canvasEmpty: boolean;
  // Spotlight is desktop-only (hover + click-to-resize don't map to touch),
  // so it is withheld on a phone the same way the dropdown omits it.
  isMobile: boolean;
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
  autoLayout: (choice?: AutoLayoutChoice) => void;
  autoAlign: () => void;
  openExport: () => void;
  openImport: () => void;
  openSettings: () => void;
  openShortcuts: () => void;
  openTemplates: () => void;
  // Switches the canvas tool — the same setter the palette's tool dropdown
  // calls, so the pressed state and telemetry are identical either way.
  setTool: (tool: string) => void;
};

// The canvas tools reachable from search, in the tool dropdown's own order.
// `ids` here MUST stay in step with buildCanvasToolOptions (a test pins it):
// the whole point is that a tool the palette offers is also typeable, and a
// stale id would hand the setter a tool that does not exist.
//
// Only the id + the words are restated. The gating (empty canvas, mobile,
// read-only) is expressed once, below.
const CANVAS_TOOLS: {
  id: string;
  name: string;
  keywords: string;
  // Acts on existing content, so it goes away on an empty canvas.
  needsContent?: boolean;
  // Changes the diagram, so a view-only visitor never sees it.
  mutates?: boolean;
  desktopOnly?: boolean;
}[] = [
  { id: 'select', name: 'Select tool', keywords: 'select pointer arrow cursor pick v' },
  { id: 'pan', name: 'Hand tool', keywords: 'hand pan grab drag move canvas scroll h' },
  {
    id: 'eraser',
    name: 'Eraser tool',
    keywords: 'eraser erase rub out delete remove e',
    needsContent: true,
    mutates: true,
  },
  {
    id: 'format',
    name: 'Format painter',
    keywords: 'format painter copy style paste style match appearance brush',
    needsContent: true,
    mutates: true,
  },
  {
    // The marker (spec/81). The one tool here that MAKES content, so unlike
    // its neighbours it stays offered on an empty canvas.
    id: 'highlighter',
    name: 'Highlighter',
    keywords: 'highlighter highlight marker pen mark up annotate emphasise emphasize yellow',
    mutates: true,
  },
  {
    id: 'laser',
    name: 'Laser pointer',
    keywords: 'laser pointer present point highlight temporary trail k',
    needsContent: true,
  },
  {
    id: 'spotlight',
    name: 'Spotlight',
    keywords: 'spotlight focus dim darken present attention',
    needsContent: true,
    desktopOnly: true,
  },
  {
    id: 'avatar',
    name: 'Avatar mode',
    keywords: 'avatar walk character presence walkthrough tour steer w',
    needsContent: true,
  },
  {
    id: 'isometric',
    name: 'Isometric view',
    keywords: 'isometric 3d tilt perspective depth angle i',
    needsContent: true,
  },
];

// The tool switches, minus whichever tool is already in force. Grouped with
// the view-safe commands because most of them only change how you LOOK at the
// canvas; the two that change it (eraser, format painter) opt in via
// `mutates` and drop out for a read-only visitor.
function toolCommands(ctx: CommandContext, h: CommandHandlers): EditorCommand[] {
  return CANVAS_TOOLS.filter(
    (t) =>
      t.id !== ctx.canvasTool &&
      !(t.needsContent && ctx.canvasEmpty) &&
      !(t.desktopOnly && ctx.isMobile) &&
      !(t.mutates && ctx.isReadOnly),
  ).map((t) => ({
    id: `tool:${t.id}`,
    name: t.name,
    keywords: `tool mode switch ${t.keywords}`,
    run: () => h.setTool(t.id),
  }));
}

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
    ...toolCommands(ctx, h),
  ];
  if (ctx.isReadOnly) return viewSafe;

  const out: EditorCommand[] = [];

  out.push(...selectionCommands(ctx, h));

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
    name: AUTO_LAYOUT_CHOICES.smart.commandName,
    keywords: AUTO_LAYOUT_CHOICES.smart.keywords,
    run: () => h.autoLayout(),
  });
  // One command per explicit layout style (spec/47 "Layout styles"), the
  // same choices the Cleanup menu offers as tiles.
  for (const styleId of AUTO_LAYOUT_STYLE_IDS) {
    out.push({
      id: `auto-layout-${styleId}`,
      name: AUTO_LAYOUT_CHOICES[styleId].commandName,
      keywords: AUTO_LAYOUT_CHOICES[styleId].keywords,
      run: () => h.autoLayout(styleId),
    });
  }
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
