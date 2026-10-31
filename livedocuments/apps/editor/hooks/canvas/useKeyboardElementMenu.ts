'use client';

// The keyboard's way into the element menu (docs/specs/004-interface-design/canvas-accessibility.md "Keyboard
// traversal"): with focus on the canvas and one element selected (Tab walks them), the Menu key or Shift+F10 opens
// that element's menu beside it, as a right-click does. livedocuments has no selection toolbar, so its More button
// is not there to reach by Tab; this is the keyboard's route for every role.

import { useEffect, type Ref } from 'react';
import { elementMenuAnchor } from '@liveworkspace/workbench/lib/context-menu-anchor';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';
import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

export function isMenuKey(e: Pick<KeyboardEvent, 'key' | 'shiftKey'>): boolean {
  return e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey);
}

export function useKeyboardElementMenu(
  mainRef: Ref<HTMLElement> | undefined,
  readSelection: () => Selection,
  open: ((id: string, screenX: number, screenY: number) => void) | undefined,
): void {
  const openRef = useLatest(open);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isMenuKey(e) || e.defaultPrevented) return;
      // The canvas itself holds focus while Tab walks its elements; anywhere else (a panel over it, a label being
      // typed in) the key keeps its own meaning.
      const main = mainRef && 'current' in mainRef ? mainRef.current : null;
      if (!main || document.activeElement !== main) return;
      const { selectedId, multiSelectedIds } = readSelection();
      if (!selectedId || multiSelectedIds.size > 0 || !openRef.current) return;
      const rect = document.querySelector(elementSelector(selectedId))?.getBoundingClientRect();
      if (!rect) return;
      // Claimed: the browser's own menu (and the canvas menu its contextmenu would open) stays shut.
      e.preventDefault();
      const { x, y } = elementMenuAnchor(rect);
      openRef.current(selectedId, x, y);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mainRef, readSelection, openRef]);
}
