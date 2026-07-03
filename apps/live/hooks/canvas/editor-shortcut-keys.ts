// The editor keyboard-shortcut contract (spec/09): the deps bag the
// hook reads through its live ref, and the plain-key tool / element
// lookup tables, split at the read-only gate. Lifted out of
// useEditorKeyboardShortcuts so the hook file holds just the listener
// wiring; the unit test asserts the key -> action mapping against
// these tables directly.

import type { CanvasTool } from '@/components/palette/CommandPalette';

// Shape kinds that have a single-key palette shortcut: the common
// flowchart set. The rest of the ShapeKind union (stadium, document,
// cloud, devices, etc.) has no memorable free letter and stays a click
// away in the palette.
type ShortcutShape = 'square' | 'circle' | 'diamond' | 'cylinder' | 'hexagon' | 'parallelogram';

export type EditorKeyboardShortcutsDeps = {
  // Modal-interaction state. Escape clears whichever is active.
  formatSourceId: string | null;
  setFormatSourceId: (v: string | null) => void;
  groupSourceId: string | null;
  setGroupSourceId: (v: string | null) => void;
  // Pending draw-to-size intent, set when the palette was clicked
  // under the drawToAdd user preference. Escape clears it so a
  // user who accidentally entered draw mode (or changed their
  // mind) can bail before clicking on the canvas. Null when no
  // draw is pending. The hook only needs to know "is something
  // pending" so we accept the opaque truthiness rather than the
  // discriminated union type itself.
  pendingDraw: unknown | null;
  onCancelDraw: () => void;
  // Selection state. Delete / Backspace acts on whichever is
  // populated (multi wins).
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  editingId: string | null;
  // True for a view-only ('view' share role) session. Suppresses
  // every mutator shortcut (delete, undo, redo, copy, paste) so the
  // browser's defaults (Backspace = navigate back, Cmd-Z = browser
  // undo) stay intact and the visitor can't desync state via
  // shortcuts that would otherwise reach the canvas.
  isReadOnly: boolean;
  // Action callbacks that perform the actual mutation. Each one is
  // a fresh closure every render: the hook reads them via a ref so
  // the keydown listener always sees the latest version.
  deleteSelected: () => void;
  deleteMultiSelected: () => void;
  undo: () => void;
  redo: () => void;
  copySelection: () => void;
  // Canvas tool setter. V / H / L cycle through select / pan /
  // laser. Mirrors the in-canvas tool picker so a keyboard user
  // can switch tools without leaving home position. View-role
  // visitors still get this (panning + lasering doesn't mutate
  // anything; selecting is harmless because the popover hides for
  // view-role).
  setCanvasTool: (t: CanvasTool) => void;
  // Active canvas tool. Read by the Escape handler so Escape exits the
  // persistent Format tool (back to Select) from either phase.
  canvasTool: CanvasTool;
  // Element-add callbacks. R / O / D / C / H / G fire addShape with the
  // matching ShortcutShape; T / N / A fire the dedicated handlers; I opens
  // the image picker. All five mirror their palette counterparts so
  // the keyboard route reaches the same code path as the click route.
  // onAddImage is nullable: pure-guest deploys without an api worker
  // hide the palette button + null this prop, and the shortcut goes
  // dormant to match.
  addShape: (kind: ShortcutShape) => void;
  addText: () => void;
  addSticky: () => void;
  addArrow: () => void;
  onAddImage: (() => void) | null;
  // F enters the one-shot pencil (freehand) draw mode, mirroring the
  // palette's Pencil button. Distinct from the element-add shortcuts
  // above because the pencil is gestural (no element drops without a
  // drag), but it lives next to them in the keyboard surface so the
  // user reaches for the same row of letters for every tool.
  onBeginFreehand: () => void;
  // Cmd/Ctrl+G: group multi-selected boxed elements, or ungroup the
  // currently-selected element's group. The callback handles both
  // cases (caller checks multi vs single selection state).
  onGroupOrUngroup: () => void;
  // Cmd/Ctrl+Shift+L: toggle lock on the current selection (single or
  // multi). On Shift+L rather than plain Cmd+L so it never fights the
  // browser's "focus the address bar" binding.
  onToggleLock: () => void;
  // Cmd/Ctrl+A: select every element on the active tab at once.
  onSelectAll: () => void;
  // Cmd/Ctrl+D: duplicate the current selection (single or multi). The
  // caller routes to the single- vs multi-select duplicate.
  onDuplicate: () => void;
  // Cmd/Ctrl+X: cut, i.e. copy the selection to the clipboard then delete
  // it. The caller composes copy + the matching delete.
  onCut: () => void;
  // Cmd/Ctrl+Shift+] / +[: raise / lower the selection in the z-order.
  // Both operate on the whole current selection.
  onBringToFront: () => void;
  onSendToBack: () => void;
  // Shift+1: fit all content on the active tab to the viewport. A pure
  // view action (allowed for view-role).
  onFitToScreen: () => void;
  // Escape with a live selection and no transient mode to cancel clears
  // the selection (single + multi). Mirrors clicking empty canvas.
  onDeselect: () => void;
  // Space-tap on a single selected element drops into label edit
  // mode (mirroring double-click on the element). Distinct from
  // Space-drag, which the canvas hook already binds to "temporary
  // pan": Space-down + drag pans the canvas, Space-down + Space-up
  // (no drag in between) edits. The hook owns the tap-vs-drag
  // detection; editor-page just hands it the selected-element edit
  // entry point.
  onBeginEditSelected: (elementId: string) => void;
  // Arrow-key nudge (spec/09 Move): move the current selection by
  // (dx, dy) canvas px. The hook decides the step (1px, or 10px with
  // Shift) and which keys map to which axis; editor-page owns the
  // actual element transform + undo coalescing.
  onNudgeSelection: (dx: number, dy: number) => void;
  // Type-to-edit (spec/09 Labels): a printable key on a single selected
  // element opens its label editor seeded with that character. Returns
  // true when it took over (so the listener swallows the key) and false
  // for a non-labelable selection (image / freehand) so the tool
  // shortcuts still fire there.
  onTypeIntoSelected: (elementId: string, char: string) => boolean;
  // Zoom controls. Allowed for view-role visitors (zooming doesn't
  // mutate the diagram). Ctrl/Cmd + = / + zooms in, - zooms out,
  // 0 resets to 100%. Mirrors the ZoomControls buttons.
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  // Zen / focus mode (spec/26). `Z` toggles it; `Escape` exits when
  // active. Allowed for view-role too (focusing doesn't mutate the
  // diagram). `zenMode` lets the listener route Escape to exit only
  // while the mode is on.
  zenMode: boolean;
  onToggleZen: () => void;
  // Cmd/Ctrl+. opens the global search panel. Allowed for view-role
  // too (search only navigates, never mutates).
  onOpenSearch: () => void;
  // Per-device disable flag. When false, every shortcut effect
  // below short-circuits before attaching its listener. The
  // checkbox lives in the keyboard-shortcuts modal; the storage
  // hook is `useShortcutsEnabled`.
  enabled: boolean;
};

// Plain-key (no modifier) tool + element shortcuts, as lookup tables so
// the letter and number aliases share one action each (no if-ladder to
// keep in sync). Keys are matched lowercased; number aliases mirror the
// Excalidraw layout. Split at the read-only gate:
//
//   VIEW_TOOL_KEYS: non-mutating view tools, allowed for view-role.
//   EDIT_KEYS:      mutating tools / element adds, editors only.
//
// Image (`9`) is handled outside the table because its callback is
// nullable (guest deploys without an api worker hide it).
// Exported for the unit test, which asserts the key -> action mapping
// against a spy `live` (the effect itself needs jsdom, which this
// workspace's node-env vitest doesn't run; see specs/18-testing.md).
export type ShortcutAction = (live: EditorKeyboardShortcutsDeps) => void;

export const VIEW_TOOL_KEYS: Record<string, ShortcutAction> = {
  v: (l) => l.setCanvasTool('select'),
  s: (l) => l.setCanvasTool('select'), // legacy alias (pre-`V` standard)
  '1': (l) => l.setCanvasTool('select'),
  h: (l) => l.setCanvasTool('pan'),
  k: (l) => l.setCanvasTool('laser'),
  i: (l) => l.setCanvasTool('isometric'), // spec/45: pans like Hand, non-mutating
  z: (l) => l.onToggleZen(), // spec/26 focus mode
};

export const EDIT_KEYS: Record<string, ShortcutAction> = {
  e: (l) => l.setCanvasTool('eraser'),
  '0': (l) => l.setCanvasTool('eraser'),
  p: (l) => l.onBeginFreehand(), // Pencil (P is free now Hand owns H)
  f: (l) => l.onBeginFreehand(), // Pencil (legacy alias)
  '7': (l) => l.onBeginFreehand(),
  r: (l) => l.addShape('square'),
  '2': (l) => l.addShape('square'),
  o: (l) => l.addShape('circle'),
  '4': (l) => l.addShape('circle'),
  d: (l) => l.addShape('diamond'),
  '3': (l) => l.addShape('diamond'),
  c: (l) => l.addShape('cylinder'),
  g: (l) => l.addShape('parallelogram'),
  t: (l) => l.addText(),
  '8': (l) => l.addText(),
  n: (l) => l.addSticky(),
  a: (l) => l.addArrow(),
  '5': (l) => l.addArrow(),
};
