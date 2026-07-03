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
import { anyModalOpen } from '@/lib/modal-guard';
import { isMobileViewportSync } from '@/lib/responsive';
import {
  EDIT_KEYS,
  VIEW_TOOL_KEYS,
  type EditorKeyboardShortcutsDeps,
} from './editor-shortcut-keys';

// Re-exported so existing importers (the unit test) keep resolving.
export { EDIT_KEYS, VIEW_TOOL_KEYS, type ShortcutAction } from './editor-shortcut-keys';

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
      // A modal dialog owns the keyboard while open (its own Escape
      // closes it); cancelling canvas modes behind it double-acts.
      if (anyModalOpen()) return;
      // A closer handler already claimed this keystroke (e.g. the table's
      // selected-cell layer) — don't double-act on it.
      if (e.defaultPrevented) return;
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
      // A modal dialog owns the keyboard while open: its buttons /
      // toggles aren't text inputs, so without this gate `R` dropped a
      // rectangle (and Backspace deleted the selection) on the canvas
      // BEHIND the modal.
      if (anyModalOpen()) return;
      // A closer handler already claimed this keystroke — the table's
      // selected-cell layer prevents default on the keys it consumes
      // (arrows / Backspace / Escape / type-to-edit), and acting on them
      // again here nudged or even deleted the whole table mid-cell-edit.
      if (e.defaultPrevented) return;
      const live = liveRef.current;
      const target = e.target as Element | null;
      // <select> included: a letter press there is the browser's
      // type-ahead, not a canvas shortcut.
      const inText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      // Any text input gets a wide berth, except for read-only
      // checks: even Delete / Backspace bail BEFORE preventDefault
      // when read-only so the browser's default behaviour for
      // those keys stays intact.
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key;
      const lower = key.toLowerCase();

      // --- Zen mode exit (spec/26) ---
      // Escape leaves zen mode. Only when actually in zen, not mid-
      // edit / typing (there Escape cancels the label edit instead),
      // and with nothing MORE transient to peel first: an active mode
      // (format / group / draw / isometric — the narrow effect above
      // owns those) or a live selection each take their own Escape, so
      // one press exits exactly one layer instead of snapping the whole
      // stack back at once.
      if (
        key === 'Escape' &&
        live.zenMode &&
        !inText &&
        live.editingId === null &&
        live.formatSourceId === null &&
        live.groupSourceId === null &&
        live.pendingDraw === null &&
        live.canvasTool !== 'format' &&
        live.canvasTool !== 'isometric' &&
        live.selectedId === null &&
        live.multiSelectedIds.size === 0
      ) {
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
