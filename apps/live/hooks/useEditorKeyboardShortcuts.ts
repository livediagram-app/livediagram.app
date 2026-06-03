// Global keyboard shortcuts for the editor route, lifted out of
// editor-page.tsx so the page file stays focused on orchestration.
//
// The callbacks (undo, redo, deleteSelected, copy, paste, setCanvasTool)
// are closures over editor-page state. They get fresh identity on
// every render. The hook stashes them in a single mutable ref that
// the keydown listeners read THROUGH, so the listener body always
// calls the latest closure even though the effect itself only re-
// attaches on `enabled` / `isReadOnly` changes. Without this, the
// historical "[enabled, isReadOnly]" deps captured stale undo /
// redo references at attach time and shortcuts that fired through
// them silently no-op'd.

import { useEffect, useRef } from 'react';

type CanvasTool = 'pan' | 'select' | 'laser';

// Shape kind subset that has a dedicated palette button + single-key
// shortcut. The wider ShapeKind union (cylinder, parallelogram,
// stadium, devices, etc.) doesn't get one: there isn't a memorable
// letter to spare without colliding with tools / copy / etc., and
// the palette is one click away anyway.
type ShortcutShape = 'square' | 'circle' | 'diamond';

type EditorKeyboardShortcutsDeps = {
  // Modal-interaction state. Escape clears whichever is active.
  formatSourceId: string | null;
  setFormatSourceId: (v: string | null) => void;
  groupSourceId: string | null;
  setGroupSourceId: (v: string | null) => void;
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
  // Element-add callbacks. R / O / D fire addShape with the matching
  // ShortcutShape; T / N / A fire the dedicated handlers; I opens
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
  // Per-device disable flag. When false, every shortcut effect
  // below short-circuits before attaching its listener. The
  // checkbox lives in the keyboard-shortcuts modal; the storage
  // hook is `useShortcutsEnabled`.
  enabled: boolean;
};

export function useEditorKeyboardShortcuts(deps: EditorKeyboardShortcutsDeps): void {
  // Single mutable ref the keydown listeners read from. Repointed
  // on every render so a stale closure can't reach an outdated
  // callback. This is the React canon for "I want fresh references
  // but I don't want to re-attach the listener on every render."
  const liveRef = useRef(deps);
  liveRef.current = deps;

  // Escape cancels the format-painter / group-source mode. Keeping
  // the narrow [formatSourceId, groupSourceId] deps means the
  // listener only attaches when one of the modes is active, so we
  // pay nothing while the user is idle. The setters come through
  // the ref so the same-render values apply.
  useEffect(() => {
    const { formatSourceId, groupSourceId, enabled } = liveRef.current;
    if (!enabled) return;
    if (formatSourceId === null && groupSourceId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        liveRef.current.setFormatSourceId(null);
        liveRef.current.setGroupSourceId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deps.enabled, deps.formatSourceId, deps.groupSourceId]);

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
        return;
      }

      // --- Plain key tool + element-add shortcuts ---
      // Mnemonic-first bindings:
      //   S = Select, P = Pan, L = Laser (tools)
      //   R = Rectangle (square), O = Oval (circle), D = Diamond
      //   T = Text, N = Note (sticky), A = Arrow, I = Image
      // Bail on text-input focus + editing-label state so the user
      // can still type literal letters into a label or comment.
      // Element-add shortcuts also check isReadOnly so view-role
      // visitors don't accidentally drop placeholder elements that
      // the server will reject anyway.
      if (inText) return;
      if (live.editingId !== null) return;
      if (lower === 's') {
        e.preventDefault();
        live.setCanvasTool('select');
        return;
      }
      if (lower === 'p') {
        e.preventDefault();
        live.setCanvasTool('pan');
        return;
      }
      if (lower === 'l') {
        e.preventDefault();
        live.setCanvasTool('laser');
        return;
      }
      if (live.isReadOnly) return;
      if (lower === 'r') {
        e.preventDefault();
        live.addShape('square');
        return;
      }
      if (lower === 'o') {
        e.preventDefault();
        live.addShape('circle');
        return;
      }
      if (lower === 'd') {
        e.preventDefault();
        live.addShape('diamond');
        return;
      }
      if (lower === 't') {
        e.preventDefault();
        live.addText();
        return;
      }
      if (lower === 'n') {
        e.preventDefault();
        live.addSticky();
        return;
      }
      if (lower === 'a') {
        e.preventDefault();
        live.addArrow();
        return;
      }
      if (lower === 'i' && live.onAddImage) {
        e.preventDefault();
        live.onAddImage();
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deps.enabled]);
}
