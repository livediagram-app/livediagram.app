// Canvas accessibility baseline (spec/71). Two concerns, both scoped
// to the active tab:
//
// - **Tab traversal**: while the canvas surface itself is focused,
//   Tab / Shift+Tab move the selection through the tab's elements in
//   render (z) order — selection IS focus, so the existing selection
//   ring doubles as the focus indicator. No wrap: walking past either
//   end falls through to the browser's default Tab, so keyboard focus
//   can always leave the canvas (no trap). Elements locked by another
//   participant are skipped, mirroring pointer selection.
// - **Announcements**: selection changes are spoken through the SR
//   live region (lib/announcer), named by the same helpers the change
//   log prints (lib/element-names).

import { useEffect, useRef } from 'react';
import { isBoxed, type Element } from '@livediagram/diagram';
import { anyModalOpen } from '@/lib/modal-guard';
import { announce } from '@/lib/announcer';
import { describeMany, describeOne } from '@/lib/element-names';
import { track } from '@/lib/telemetry';

// The traversal step, pure so it's unit-testable: which element index a
// Tab (dir 1) / Shift+Tab (dir -1) press should select, or null when the
// walk runs off either end (the caller then lets the browser's default
// Tab move focus on — no wrap, no trap). Blocked ids (locked by another
// participant) are skipped.
export function nextTraversalIndex(
  elements: readonly { id: string }[],
  selectedId: string | null,
  dir: 1 | -1,
  isBlocked: (id: string) => boolean,
): number | null {
  if (elements.length === 0) return null;
  const currentIndex = selectedId ? elements.findIndex((el) => el.id === selectedId) : -1;
  // First press with nothing selected starts at the nearest end.
  let i = currentIndex === -1 && dir === -1 ? elements.length - 1 : currentIndex + dir;
  while (i >= 0 && i < elements.length && isBlocked(elements[i]!.id)) i += dir;
  return i >= 0 && i < elements.length ? i : null;
}

type CanvasA11yDeps = {
  // The per-device shortcuts toggle: traversal is a keyboard shortcut
  // surface, so it honours the same switch.
  enabled: boolean;
  elements: Element[];
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  editingId: string | null;
  selectElement: (id: string) => void;
  lockedByOther: (id: string) => boolean;
  scrollIntoView: (x: number, y: number, w: number, h: number) => void;
};

export function useCanvasA11y(deps: CanvasA11yDeps): void {
  // Live ref so the mount-once listener reads current state without
  // re-subscribing per keystroke (the editor-shortcuts hub's pattern).
  const ref = useRef(deps);
  ref.current = deps;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.defaultPrevented) return;
      if (anyModalOpen()) return;
      const live = ref.current;
      if (!live.enabled) return;
      if (live.editingId !== null) return;
      // Engage only when the canvas surface ITSELF is focused. Focus on
      // anything else (palette buttons, panels, header) keeps the
      // browser's normal Tab order.
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active.dataset.canvasA11yRoot === undefined) return;
      const els = live.elements;
      const dir = e.shiftKey ? -1 : 1;
      const i = nextTraversalIndex(els, live.selectedId, dir, live.lockedByOther);
      // Past either end: leave the event to the browser so focus moves
      // on to the next control — deliberately no wrap.
      if (i === null) return;
      const next = els[i]!;
      e.preventDefault();
      live.selectElement(next.id);
      if (isBoxed(next)) live.scrollIntoView(next.x, next.y, next.width, next.height);
      track('Element', 'Selected', 'Keyboard');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Announce selection changes: single ("Selected 'Login'"), multi (the
  // change-log style summary), and clearing. Keyed on a stable string so
  // reorderings of the same multi-selection don't re-announce.
  const selectionKey =
    deps.multiSelectedIds.size > 0
      ? [...deps.multiSelectedIds].sort().join(',')
      : (deps.selectedId ?? '');
  const prevKeyRef = useRef(selectionKey);
  useEffect(() => {
    if (selectionKey === prevKeyRef.current) return;
    const hadSelection = prevKeyRef.current !== '';
    prevKeyRef.current = selectionKey;
    const live = ref.current;
    if (live.multiSelectedIds.size > 0) {
      const members = live.elements.filter((el) => live.multiSelectedIds.has(el.id));
      if (members.length > 0) announce(`Selected ${describeMany(members)}`);
      return;
    }
    if (live.selectedId) {
      const el = live.elements.find((x) => x.id === live.selectedId);
      if (el) announce(`Selected ${describeOne(el)}`);
      return;
    }
    if (hadSelection) announce('Selection cleared');
  }, [selectionKey]);
}
