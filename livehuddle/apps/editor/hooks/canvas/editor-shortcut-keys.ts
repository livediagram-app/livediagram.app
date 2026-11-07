// The editor keyboard-shortcut contract (docs/specs/008-canvas/canvas-and-palette.md): the deps bag the
// hook reads through its live ref, and the plain-key tool / element
// lookup tables, split at the read-only gate. Lifted out of
// useEditorKeyboardShortcuts so the hook file holds just the listener
// wiring; the unit test asserts the key -> action mapping against
// these tables directly.

import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import type { CanvasTool } from '@/components/palette/palette.types';
import { requestToolbarSearch } from '@liveworkspace/workbench/lib/toolbar-search-request';

// Shape kinds that have a single-key palette shortcut: the common
// flowchart set. The rest of the ShapeKind union (stadium, document,
// cloud, devices, etc.) has no memorable free letter and stays a click
// away in the palette.
type ShortcutShape = 'square' | 'circle' | 'diamond' | 'cylinder' | 'hexagon' | 'parallelogram';

export type EditorKeyboardShortcutsDeps = {
  // Modal-interaction state. Escape clears whichever is active.
  formatSourceId: string | null;
  setFormatSourceId: (v: string | null) => void;
  // Pending draw-to-size intent, set when the palette was clicked
  // under the drawToAdd user preference. Escape clears it so a
  // user who accidentally entered draw mode (or changed their
  // mind) can bail before clicking on the canvas. Null when no
  // draw is pending. The hook only needs to know "is something
  // pending" so we accept the opaque truthiness rather than the
  // discriminated union type itself.
  pendingDraw: unknown;
  onCancelDraw: () => void;
  // Enter's tap: drops the armed tile at the middle of the view. False when the intent has no tap
  // (a pen, the Path or Fill tool), so the key is left alone.
  onDropDrawAtCentre: () => boolean;
  // Selection state. Delete / Backspace acts on whichever is
  // populated (multi wins).
  // Read when a key is pressed (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
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
  // Canvas tool setter: E / V edit and W walks, the Edit | Walk toggle's keys (docs/specs/008-canvas/avatar-mode.md
  // "The Edit | Walk toggle"). Before the read-only gate, so an Editor on a locked tab has them too; a session held
  // walking is refused every tool but Avatar by useCanvasTool's hold.
  setCanvasTool: (t: CanvasTool) => void;
  // Active canvas tool. Read by the Escape handler so Escape exits the
  // persistent Format tool (back to Select) from either phase.
  canvasTool: CanvasTool;
  // Element-add callbacks. T and N fire the dedicated handlers, each mirroring its palette counterpart so the
  // keyboard route reaches the same code path as the click route. No `9`: livehuddle adds no image
  // (docs/specs/002-project-scope/not-in-livehuddle.md "Media: Image and Link card").
  addShape: (kind: ShortcutShape) => void;
  addText: () => void;
  addSticky: () => void;
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
  // Arrow-key nudge (docs/specs/008-canvas/canvas-and-palette.md Move): move the current selection by
  // (dx, dy) canvas px. The hook decides the step (1px, or 10px with
  // Shift) and which keys map to which axis; editor-page owns the
  // actual element transform + undo coalescing.
  onNudgeSelection: (dx: number, dy: number) => void;
  // Type-to-edit (docs/specs/008-canvas/canvas-and-palette.md Labels): a printable key on a single selected
  // element opens its label editor seeded with that character. Returns
  // true when it took over (so the listener swallows the key) and false
  // for a non-labelable selection (image / freehand) so the tool
  // shortcuts still fire there.
  onTypeIntoSelected: (elementId: string, char: string) => boolean;

  // Zoom controls. Allowed for view-role visitors (zooming doesn't
  // change the document). Ctrl/Cmd + = / + zooms in, - zooms out,
  // 0 resets to 100%. Mirrors the ZoomControls buttons.
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
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
// workspace's node-env vitest doesn't run; see docs/specs/003-system-architecture/testing.md).
export type ShortcutAction = (live: EditorKeyboardShortcutsDeps) => void;

export const VIEW_TOOL_KEYS: Record<string, ShortcutAction> = {
  // Edit (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle"): E, and V as the drawing tools have it.
  e: (l) => l.setCanvasTool('select'),
  v: (l) => l.setCanvasTool('select'),
  // Opens the Toolbar strip's Search where there is one (docs/specs/007-editor/toolbar-layout.md
  // "Search: every element type"); elsewhere still the legacy Select alias (pre-`V` standard).
  s: (l) => {
    if (!requestToolbarSearch()) l.setCanvasTool('select');
  },
  '1': (l) => l.setCanvasTool('select'),
  // Walk. Only from editing: walking, W is the Wave (avatar-action-keys), which the listener plays first. No H: Hand
  // is not a mode (Space-drag, the trackpad and the middle button pan).
  w: (l) => l.setCanvasTool('avatar'),
};

// The meeting palette's keys (docs/specs/012-collaboration/workshop-mode.md "The palette"): text and the sticky note.
// No eraser: livehuddle has none (docs/specs/002-project-scope/not-in-livehuddle.md "Hand, Eraser and Format as modes"). The diagram tools' keys (R, O, D, C, G, A, P and 2 to 7) left with those tools (Work Tracker #423), and
// F with the Frame (docs/specs/002-project-scope/not-in-livehuddle.md "The Frame"); a press of one does nothing.
export const EDIT_KEYS: Record<string, ShortcutAction> = {
  t: (l) => l.addText(),
  '8': (l) => l.addText(),
  n: (l) => l.addSticky(),
};

// Cmd / Ctrl modified shortcuts. Returns true when it consumed the event.
//
// Lifted out of useEditorKeyboardShortcuts' keydown, which was 477 lines with
// this as its largest branch. It lives here beside VIEW_TOOL_KEYS / EDIT_KEYS
// because it answers the same question they do (which editor action does this
// key run?), just for the chord case, where a plain Record can't express the
// Shift and `code` variants below.
//
// The caller keeps what only it can know: that a modal isn't open, that the
// event wasn't already handled, and that focus isn't in a text field. It also
// keeps swallowing a modified key we do NOT handle, so a stray Cmd+J can't
// fall through to the plain-key table and drop a shape.
//
// Cmd+V is intentionally absent. The browser's native `paste` event fires on
// Cmd/Ctrl+V and carries the system clipboard (text, files, images);
// editor-page listens for paste directly so it can route images from the
// system clipboard to image-upload, falling back to the in-app element
// clipboard when no system content is present.
// Whether text outside any input is highlighted on the page (inputs handle their own copy before this).
function hasPageTextSelection(): boolean {
  if (typeof window === 'undefined') return false;
  const sel = window.getSelection();
  return !!sel && !sel.isCollapsed && sel.toString().trim() !== '';
}

export function runModShortcut(e: KeyboardEvent, live: EditorKeyboardShortcutsDeps): boolean {
  const key = e.key;
  const lower = key.toLowerCase();
  // Zoom: allowed for view-role visitors — doesn't change the document.
  // + / = zoom in (= is the unshifted + key), - zooms out, 0 resets.
  if (key === '=' || key === '+') {
    e.preventDefault();
    live.onZoomIn();
    return true;
  }
  if (key === '-') {
    e.preventDefault();
    live.onZoomOut();
    return true;
  }
  if (key === '0') {
    e.preventDefault();
    live.onZoomReset();
    return true;
  }
  // Cmd/Ctrl+. and Cmd/Ctrl+K: open the global search panel.
  // Before the read-only gate — search only navigates. ('.'
  // instead of 'T' because browsers reserve Cmd/Ctrl+T for "new
  // tab" and won't let the page intercept it; 'K' is the
  // command-palette convention, docs/specs/007-editor/command-palette.md.)
  if (key === '.' || lower === 'k') {
    e.preventDefault();
    live.onOpenSearch();
    return true;
  }
  // A Viewer and a Participant (docs/specs/013-workspace/share-roles.md "A Participant walks") get the zoom + search
  // chords above and nothing below. Nothing was dispatched, so this is `false`:
  // the caller swallows the key either way.
  if (live.isReadOnly) return false;
  // Walking (docs/specs/008-canvas/avatar-mode.md "No editing chrome while walking"): no Undo or Redo, so a stray key
  // never changes the Space behind you. Not dispatched, so the caller swallows the browser's own undo too.
  if (live.canvasTool === 'avatar' && (lower === 'z' || lower === 'y')) return false;
  // Redo: Cmd-Shift-Z, Ctrl-Y, Ctrl-Shift-Z.
  if (lower === 'y' || (lower === 'z' && e.shiftKey)) {
    e.preventDefault();
    live.redo();
    return true;
  }
  if (lower === 'z') {
    e.preventDefault();
    live.undo();
    return true;
  }
  // Every chord below is an Editor's.
  if (live.isReadOnly) return false;
  if (lower === 'c') {
    // Text selected on the page (a comment, a share link, a panel) is the browser's to copy: the
    // canvas copy would copy nothing, or the selected elements instead of what was highlighted.
    if (hasPageTextSelection()) return false;
    e.preventDefault();
    live.copySelection();
    return true;
  }
  // Cut: copy + delete in one. The caller composes the two.
  if (lower === 'x') {
    e.preventDefault();
    live.onCut();
    return true;
  }
  // Duplicate. Plain `d` is Diamond; the modifier disambiguates.
  if (lower === 'd') {
    e.preventDefault();
    live.onDuplicate();
    return true;
  }
  // Lock on Cmd/Ctrl+Shift+L (not plain Cmd+L, which the browser
  // reserves for the address bar).
  if (lower === 'l' && e.shiftKey) {
    e.preventDefault();
    live.onToggleLock();
    return true;
  }
  if (lower === 'a') {
    e.preventDefault();
    live.onSelectAll();
    return true;
  }
  // Z-order: Cmd/Ctrl+Shift+] front, +[ back. Match on `code` so
  // the shifted bracket characters (`}` / `{`) don't fool the key
  // compare on non-US layouts.
  if (e.shiftKey && (e.code === 'BracketRight' || key === ']' || key === '}')) {
    e.preventDefault();
    live.onBringToFront();
    return true;
  }
  if (e.shiftKey && (e.code === 'BracketLeft' || key === '[' || key === '{')) {
    e.preventDefault();
    live.onSendToBack();
    return true;
  }
  return false;
}

// What a key does on a canvas that may not take it (a Viewer's or a Participant's, docs/specs/013-workspace/share-roles.md):
// `run` leaves the canvas alone (undo, redo, search, the mode switch, Escape) and is handled as usual; `swallow`
// is a canvas chord the browser would act on in its place (duplicate, select-all, lock, z-order, zoom), so it is
// prevented and does nothing; `ignore` is every other key, left to the browser.
type CoveredKeyRole = 'run' | 'swallow' | 'ignore';
export function coveredKeyRole(
  e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
): CoveredKeyRole {
  const lower = e.key.toLowerCase();
  if (e.metaKey || e.ctrlKey) {
    if (lower === 'z' || lower === 'y' || lower === 'k' || e.key === '.') return 'run';
    if (
      lower === 'd' ||
      lower === 'a' ||
      (lower === 'l' && e.shiftKey) ||
      e.key === '=' ||
      e.key === '+' ||
      e.key === '-' ||
      e.key === '0' ||
      (e.shiftKey &&
        (e.code === 'BracketRight' || e.code === 'BracketLeft' || '[]{}'.includes(e.key)))
    )
      return 'swallow';
    return 'ignore';
  }
  if (e.key === 'Escape') return 'run';
  if (lower === 'z' && !e.shiftKey && !e.altKey) return 'run';
  if (lower === 'd' && e.shiftKey && !e.altKey) return 'run';
  return 'ignore';
}
