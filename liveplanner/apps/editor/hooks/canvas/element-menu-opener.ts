'use client';

// Opens an element's context menu from a control inside the element (docs/specs/026-plan/plan-board.md "The board
// set-up": a board header's ⋯), anchored under that control. The canvas host owns the menu, so it registers how to
// open it (useElementMenuOpener); with no editable canvas on screen there is nothing to open.
import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EditorContextMenuState } from '@/components/palette/EditorContextMenu.types';
import { useLatest } from '@/hooks/ui/useLatest';

type Opener = (elementId: string, anchor: DOMRect) => void;
let opener: Opener | null = null;

// Opens `elementId`'s menu under `anchor`, or closes it when it is already open for that element (a toggle, as
// the selection toolbar's ⋯ is).
export function openElementMenu(elementId: string, anchor: DOMRect): boolean {
  if (!opener) return false;
  opener(elementId, anchor);
  return true;
}

export function useElementMenuOpener(
  setContextMenu: Dispatch<SetStateAction<EditorContextMenuState | null>>,
  enabled: boolean,
  // Selects the element the menu acts on; false when it may not be (a peer holds it).
  select: (elementId: string) => boolean,
): void {
  const latest = useLatest({ select });
  useEffect(() => {
    if (!enabled) return;
    const open: Opener = (elementId, anchor) => {
      if (!latest.current.select(elementId)) return;
      setContextMenu((cur) =>
        cur && cur.mode === 'element' && cur.elementId === elementId
          ? null
          : { mode: 'element', elementId, x: anchor.left, y: anchor.bottom + 4 },
      );
    };
    opener = open;
    return () => {
      if (opener === open) opener = null;
    };
  }, [setContextMenu, enabled, latest]);
}
