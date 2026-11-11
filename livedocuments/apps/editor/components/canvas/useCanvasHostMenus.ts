'use client';

import { useState } from 'react';
import type { LockHolder } from '@liveworkspace/workbench/components/canvas/LockedElementMenu';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { CanvasProps } from '@/components/canvas/Canvas.types';

/** An open locked-element menu: the element, where it opened, and who holds it. */
export type LockedMenuState = {
  elementId: string;
  at: { x: number; y: number };
  holders: LockHolder[];
};

// The canvas's menu and deselect gestures for EditorCanvasHost: which menu a right-click opens, and what a
// background click puts away. Kept together because they decide the same thing, the one menu on screen.
export function useCanvasHostMenus(): Pick<
  CanvasProps,
  | 'onDeselect'
  | 'onElementContextMenu'
  | 'onMultiContextMenu'
  | 'onOpenMultiContextMenu'
  | 'onCanvasContextMenu'
> & {
  lockedMenu: LockedMenuState | null;
  setLockedMenu: (menu: LockedMenuState | null) => void;
} {
  const {
    canvasTool,
    exitFormatTool,
    cancelConnect,
    setSelectedId,
    setMultiSelectedIds,
    setEditingId,
    setFormatSourceId,
    setContextMenu,
    isReadOnly,
    lockedByOther,
    remoteSelectionsByElement,
  } = useEditorContext();
  // The menu on an element somebody else is holding (docs/specs/007-editor/editor-app.md).
  // Null when closed. Holders are captured at open time rather than re-read on
  // render: if the holder lets go while the menu is up it closes on the next
  // outside click anyway, and a list that emptied underneath would leave a
  // menu with nothing in it.
  const [lockedMenu, setLockedMenu] = useState<LockedMenuState | null>(null);
  return {
    lockedMenu,
    setLockedMenu,
    onDeselect: () => {
      // Clicking empty canvas also cancels an armed arrow-connect, and
      // wraps up the Format tool (restoring the pre-Format tool) so a
      // background click is the quick way out of paint mode (docs/specs/008-canvas/canvas-and-palette.md).
      if (canvasTool === 'format') exitFormatTool();
      cancelConnect();
      setSelectedId(null);
      setMultiSelectedIds(new Set());
      setEditingId(null);
      setFormatSourceId(null);
      setContextMenu(null);
    },
    onElementContextMenu: (id, sx, sy) => {
      // Concurrent-selection lock (docs/specs/007-editor/editor-app.md): a peer holds this
      // element, so it can't be selected, dragged, or edited, don't
      // pop a dead context menu on it either. Same gate as
      // selectElement.
      //
      // An Editor's one action on a locked element is freeing it, and that gets
      // its own small menu rather than the element's real one, whose every
      // other row would be dead. See LockedElementMenu. A Participant or a Viewer
      // still opens its own menu there (comments, a link), less Edit Text
      // (docs/specs/008-canvas/element-menu-quick-bar.md).
      if (!isReadOnly && lockedByOther(id)) {
        const holders = remoteSelectionsByElement.get(id);
        if (holders?.length) {
          setLockedMenu({ elementId: id, at: { x: sx, y: sy }, holders });
        }
        return;
      }
      // Right-clicking the element that already owns the menu AT THE
      // SAME ANCHOR is a no-op: return the SAME state object so React
      // re-renders nothing. Re-opening would restart the entrance
      // animation and flash the selection popover in the gap, for a
      // gesture that asked for the menu already on screen.
      //
      // The anchor has to be part of that comparison: selectElement
      // runs first and retargets an open menu's elementId in place
      // (keeping the old x / y), so an id-only check would see 'same
      // element' for a right-click on a DIFFERENT one and strand the
      // menu at the previous element's position.
      setContextMenu((cur) =>
        cur && cur.mode === 'element' && cur.elementId === id && cur.x === sx && cur.y === sy
          ? cur
          : { mode: 'element', elementId: id, x: sx, y: sy },
      );
    },
    onMultiContextMenu: isReadOnly
      ? undefined
      : // Right-click on a group / multi-selection always OPENS at the
        // cursor (a direct set, like onElementContextMenu). A toggle here
        // meant a lingering multi menu (which clicking elsewhere doesn't
        // dismiss, since element pointerdown stops propagation) got
        // closed by the next right-click instead of reopening, so the
        // group menu "wouldn't open".
        (sx, sy) => setContextMenu({ mode: 'multi', x: sx, y: sy }),
    onOpenMultiContextMenu: isReadOnly
      ? undefined
      : (sx, sy) =>
          // Toggle: the selection toolbar's ⋯ button closes an
          // already-open multi menu instead of reopening it.
          setContextMenu((cur) =>
            cur && cur.mode === 'multi' ? null : { mode: 'multi', x: sx, y: sy },
          ),
    onCanvasContextMenu: isReadOnly
      ? undefined
      : (sx, sy) =>
          setContextMenu({
            mode: 'canvas',
            x: sx,
            y: sy,
            // Open upward when the click is in the bottom fifth of the
            // viewport so the canvas menu's categories don't run
            // off-screen (matching the tab menu).
            openUp: sy > window.innerHeight * 0.8,
          }),
  };
}
