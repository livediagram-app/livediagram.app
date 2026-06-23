// Global keyboard shortcuts for the editor route, lifted out of
// editor-page.tsx so the page file stays focused on orchestration.
//
// The callbacks (undo, redo, deleteSelected, copy, paste, setCanvasTool,
// add*, beginEdit, etc.) and the per-render selection / isReadOnly /
// editingId state are all closures over editor-page state, so they
// get fresh identity on every render. The hook stashes the whole
// deps bag in a single mutable ref that the keydown listeners read
// THROUGH, so the listener body always sees the latest closure
// even though the main effects only re-attach on `enabled` (one
// extra Escape effect also keys on the transient mode flags it
// gates on, but never on the per-render callbacks or selection).
// Historical bug this avoids: when the listener deps included
// `isReadOnly` + the action callbacks directly, the effect re-
// attached on every render and captured stale undo / redo
// references at attach time, so shortcuts fired through them
// silently no-op'd.

import { useEffect, useRef } from 'react';
import type { CanvasTool } from '@/components/palette/CommandPalette';
import { isMobileViewportSync } from '@/lib/responsive';

// Shape kinds that have a single-key palette shortcut: the common
// flowchart set. The rest of the ShapeKind union (stadium, document,
// cloud, devices, etc.) has no memorable free letter and stays a click
// away in the palette.
type ShortcutShape = 'square' | 'circle' | 'diamond' | 'cylinder' | 'hexagon' | 'parallelogram';

type EditorKeyboardShortcutsDeps = {
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

export function useEditorKeyboardShortcuts(deps: EditorKeyboardShortcutsDeps): void {
  // Single mutable ref the keydown listeners read from. Repointed
  // on every render so a stale closure can't reach an outdated
  // callback. This is the React canon for "I want fresh references
  // but I don't want to re-attach the listener on every render."
  const liveRef = useRef(deps);
  liveRef.current = deps;

  // Escape cancels whichever transient editor mode is active:
  // format-painter, group-source, or a pending draw-to-size shape.
  // Keeping the narrow deps means the listener only attaches while
  // one of those modes is on, so we pay nothing in the idle case.
  // The setters come through the ref so the same-render values apply.
  useEffect(() => {
    const { formatSourceId, groupSourceId, pendingDraw, canvasTool, enabled } = liveRef.current;
    if (!enabled) return;
    if (
      formatSourceId === null &&
      groupSourceId === null &&
      pendingDraw === null &&
      canvasTool !== 'format' &&
      canvasTool !== 'isometric'
    )
      return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        liveRef.current.setFormatSourceId(null);
        liveRef.current.setGroupSourceId(null);
        // Persistent Format tool: Escape exits the tool entirely (back to
        // Select) from either phase, not just disarming the base.
        if (liveRef.current.canvasTool === 'format') liveRef.current.setCanvasTool('select');
        // Isometric: Escape leaves the view back to the normal editing tool —
        // Select on desktop, Hand (pan) on touch where Select isn't the
        // default. Mirrors how Spotlight reverts to Select.
        if (liveRef.current.canvasTool === 'isometric') {
          liveRef.current.setCanvasTool(isMobileViewportSync() ? 'pan' : 'select');
        }
        if (liveRef.current.pendingDraw !== null) {
          liveRef.current.onCancelDraw();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deps.enabled, deps.formatSourceId, deps.groupSourceId, deps.pendingDraw, deps.canvasTool]);

  // Everything else: Delete / Backspace, Cmd-Z / Cmd-Y / Cmd-Shift-Z,
  // Cmd-C / Cmd-V, V / H / L tool switches. One listener for the
  // whole keyboard since they all share the typing-bailout + read-
  // only-bailout logic.
  useEffect(() => {
    if (!deps.enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const live = liveRef.current;
      const target = e.target as Element | null;
      const inText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      // Any text input gets a wide berth, except for read-only
      // checks: even Delete / Backspace bail BEFORE preventDefault
      // when read-only so the browser's default behaviour for
      // those keys stays intact.
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key;
      const lower = key.toLowerCase();

      // --- Zen mode exit (spec/26) ---
      // Escape leaves zen mode. Only when actually in zen and not mid-
      // edit / typing (there Escape cancels the label edit instead).
      if (key === 'Escape' && live.zenMode && !inText && live.editingId === null) {
        e.preventDefault();
        live.onToggleZen();
        return;
      }

      // --- Escape clears the selection ---
      // When Escape has no transient mode to cancel (the narrow first
      // effect above owns format / group / pending-draw / Format /
      // Isometric) and the user isn't typing, a live selection is
      // dropped, mirroring a click on empty canvas. Guarded on the same
      // mode flags so a single Escape does one thing: cancel the mode
      // OR deselect, never both.
      if (
        key === 'Escape' &&
        !inText &&
        live.editingId === null &&
        live.formatSourceId === null &&
        live.groupSourceId === null &&
        live.pendingDraw === null &&
        live.canvasTool !== 'format' &&
        live.canvasTool !== 'isometric' &&
        (live.selectedId !== null || live.multiSelectedIds.size > 0)
      ) {
        e.preventDefault();
        live.onDeselect();
        return;
      }

      // --- Delete / Backspace ---
      if (key === 'Delete' || key === 'Backspace') {
        if (live.isReadOnly) return;
        if (inText) return;
        if (live.editingId !== null) return;
        if (live.multiSelectedIds.size > 0) {
          e.preventDefault();
          live.deleteMultiSelected();
        } else if (live.selectedId !== null) {
          e.preventDefault();
          live.deleteSelected();
        }
        return;
      }

      // --- Cmd / Ctrl modified shortcuts ---
      // Cmd+V is intentionally NOT handled here. The browser's
      // native `paste` event fires on Cmd/Ctrl+V and carries the
      // system clipboard contents (text, files, images). editor-page
      // listens for paste directly so it can route images from the
      // system clipboard to image-upload, falling back to the
      // in-app element clipboard when no system content is present.
      if (mod) {
        if (inText) return;
        // Zoom: allowed for view-role visitors — doesn't mutate the diagram.
        // + / = zoom in (= is the unshifted + key), - zooms out, 0 resets.
        if (key === '=' || key === '+') {
          e.preventDefault();
          live.onZoomIn();
          return;
        }
        if (key === '-') {
          e.preventDefault();
          live.onZoomOut();
          return;
        }
        if (key === '0') {
          e.preventDefault();
          live.onZoomReset();
          return;
        }
        // Cmd/Ctrl+.: open the global search panel. Before the
        // read-only gate — search only navigates. ('.' instead of 'T'
        // because browsers reserve Cmd/Ctrl+T for "new tab" and won't
        // let the page intercept it.)
        if (key === '.') {
          e.preventDefault();
          live.onOpenSearch();
          return;
        }
        if (live.isReadOnly) return;
        // Redo: Cmd-Shift-Z, Ctrl-Y, Ctrl-Shift-Z.
        if (lower === 'y' || (lower === 'z' && e.shiftKey)) {
          e.preventDefault();
          live.redo();
          return;
        }
        if (lower === 'z') {
          e.preventDefault();
          live.undo();
          return;
        }
        if (lower === 'c') {
          e.preventDefault();
          live.copySelection();
          return;
        }
        // Cut: copy + delete in one. The caller composes the two.
        if (lower === 'x') {
          e.preventDefault();
          live.onCut();
          return;
        }
        // Duplicate. Plain `d` is Diamond; the modifier disambiguates.
        if (lower === 'd') {
          e.preventDefault();
          live.onDuplicate();
          return;
        }
        if (lower === 'g') {
          e.preventDefault();
          live.onGroupOrUngroup();
          return;
        }
        // Lock on Cmd/Ctrl+Shift+L (not plain Cmd+L, which the browser
        // reserves for the address bar).
        if (lower === 'l' && e.shiftKey) {
          e.preventDefault();
          live.onToggleLock();
          return;
        }
        if (lower === 'a') {
          e.preventDefault();
          live.onSelectAll();
          return;
        }
        // Z-order: Cmd/Ctrl+Shift+] front, +[ back. Match on `code` so
        // the shifted bracket characters (`}` / `{`) don't fool the key
        // compare on non-US layouts.
        if (e.shiftKey && (e.code === 'BracketRight' || key === ']' || key === '}')) {
          e.preventDefault();
          live.onBringToFront();
          return;
        }
        if (e.shiftKey && (e.code === 'BracketLeft' || key === '[' || key === '{')) {
          e.preventDefault();
          live.onSendToBack();
          return;
        }
        return;
      }

      // --- Plain key tool + element-add shortcuts ---
      // Standards-aligned bindings (Excalidraw / tldraw / Figma / Miro),
      // dispatched via VIEW_TOOL_KEYS / EDIT_KEYS above:
      //   V (S alias) = Select, H = Hand, K = Laser, I = Isometric,
      //   Z = Zen, E = Eraser, P (F alias) = Pencil (tools)
      //   R = Rectangle, O = Oval, D = Diamond, C = Cylinder,
      //   G = Parallelogram, T = Text, N = Note, A = Arrow (elements)
      //   1-9/0 mirror the same actions (Excalidraw number row).
      // The plain shape keys never collide with Cmd/Ctrl+C / +G (copy /
      // group) etc., which are handled in the modifier block above and
      // return before reaching here.
      // Bail on text-input focus + editing-label state so the user
      // can still type literal letters into a label or comment.
      // Element-add shortcuts also check isReadOnly so view-role
      // visitors don't accidentally drop placeholder elements that
      // the server will reject anyway.
      if (inText) return;
      if (live.editingId !== null) return;

      // --- Arrow-key nudge (spec/09 Move) ---
      // Move the selection 1px per press, 10px with Shift. Bails for
      // view-role (no mutation) and when nothing is selected (so the
      // arrows keep their default page behaviour). Placed before the
      // letter shortcuts; arrow keys never collide with them.
      if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
        if (live.isReadOnly) return;
        const hasSelection = live.multiSelectedIds.size > 0 || live.selectedId !== null;
        if (!hasSelection) return;
        const step = e.shiftKey ? 10 : 1;
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        e.preventDefault();
        live.onNudgeSelection(dx, dy);
        return;
      }

      // --- Zoom to fit (Shift+1) ---
      // Matched on `code` (not `key`) because Shift turns "1" into "!"
      // on US layouts; `Digit1` is layout-stable. Non-mutating, so it
      // runs before the read-only gate and before type-to-edit (which
      // would otherwise seed a label with "!").
      if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault();
        live.onFitToScreen();
        return;
      }

      // --- Type-to-edit (spec/09 Labels) ---
      // A printable key on a single selected, label-bearing element
      // opens its label editor seeded with that character, INSTEAD of
      // firing the tool / add shortcuts below — the user kept selecting
      // a shape, typing, and accidentally dropping new elements. Space
      // is excluded (it stays the pan / tap-to-edit modifier). View-role
      // never types (so viewers keep V / H / K). A non-labelable selection
      // returns false and falls through to the shortcuts.
      if (
        !live.isReadOnly &&
        live.selectedId !== null &&
        live.multiSelectedIds.size === 0 &&
        key.length === 1 &&
        key !== ' '
      ) {
        if (live.onTypeIntoSelected(live.selectedId, key)) {
          e.preventDefault();
          return;
        }
      }

      // Non-mutating view tools (Select / Hand / Laser / Isometric /
      // Zen): before the read-only gate so view-role visitors get them.
      const viewAction = VIEW_TOOL_KEYS[lower];
      if (viewAction) {
        e.preventDefault();
        viewAction(live);
        return;
      }

      if (live.isReadOnly) return;

      // Image (`9`): separate from EDIT_KEYS because its callback is
      // nullable on guest deploys without an api worker.
      if (lower === '9' && live.onAddImage) {
        e.preventDefault();
        live.onAddImage();
        return;
      }

      // Mutating tools / element adds (Eraser / Pencil / shapes / Text /
      // Note / Arrow), editors only.
      const editAction = EDIT_KEYS[lower];
      if (editAction) {
        e.preventDefault();
        editAction(live);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deps.enabled]);

  // Space-tap on a selected element enters label edit mode. Held-
  // Space-with-drag stays as the canvas pan modifier (see
  // useCanvasPanAndMarquee); we distinguish a tap from a hold by
  // watching for a pointerdown between Space-down and Space-up. If
  // any pointerdown fires while Space is held, treat it as
  // pan-drag and skip the edit; otherwise the keyup fires the
  // beginEdit call. The repeat-key check stops a held Space
  // (autorepeat) from spuriously triggering on every fired keydown.
  useEffect(() => {
    if (!deps.enabled) return;
    let spaceDownAt: number | null = null;
    let pointerDownSinceSpace = false;
    const isTypingTarget = (t: EventTarget | null) =>
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      (t instanceof HTMLElement && t.isContentEditable);
    const onPointerDown = () => {
      if (spaceDownAt !== null) pointerDownSinceSpace = true;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (e.repeat) return;
      if (isTypingTarget(e.target)) return;
      if (spaceDownAt === null) {
        spaceDownAt = performance.now();
        pointerDownSinceSpace = false;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const heldFor = spaceDownAt !== null ? performance.now() - spaceDownAt : Infinity;
      const wasDrag = pointerDownSinceSpace;
      spaceDownAt = null;
      pointerDownSinceSpace = false;
      if (wasDrag) return;
      if (heldFor > 600) return; // long-press with no drag is not a tap
      const live = liveRef.current;
      if (live.isReadOnly) return;
      if (live.editingId !== null) return;
      if (isTypingTarget(e.target)) return;
      // Only act on single-element selections: multi-select Space
      // has no well-defined "which element gets the label edit"
      // answer, so leave the pan modifier as the only behaviour
      // there.
      if (live.multiSelectedIds.size > 0) return;
      if (live.selectedId === null) return;
      e.preventDefault();
      live.onBeginEditSelected(live.selectedId);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [deps.enabled]);
}
