// The canvas's menu doors (docs/specs/008-canvas/element-menu-quick-bar.md): a right-click on an element, a group or
// the canvas, an element's or the selection's ⋯ and a Behaviours element's settings, each opening the one context
// menu at its anchor. Split from EditorCanvasHost, which spreads these into the Canvas; a read-only visitor gets the
// element menu alone.
import type { CanvasProps } from '@/components/canvas/Canvas.types';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { elementMenuAnchor } from '@liveworkspace/workbench/lib/context-menu-anchor';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';

export function useCanvasMenuProps(): Pick<
  CanvasProps,
  | 'onOpenElementSettings'
  | 'onElementContextMenu'
  | 'onMultiContextMenu'
  | 'onOpenMultiContextMenu'
  | 'onOpenElementContextMenu'
  | 'onCanvasContextMenu'
> {
  const { isReadOnly, lockedByOther, setContextMenu } = useEditorContext();
  return {
    onOpenElementSettings: isReadOnly
      ? undefined
      : (elementId) => {
          const node = document.querySelector(elementSelector(elementId));
          if (!(node instanceof HTMLElement)) return;
          const { x, y } = elementMenuAnchor(node.getBoundingClientRect());
          setContextMenu({ mode: 'element', elementId, x, y });
        },
    onElementContextMenu: (id, sx, sy) => {
      // Concurrent-selection lock (docs/specs/007-editor/editor-app.md): a peer holds this
      // element, so it can't be selected, dragged, or edited, so don't
      // pop a dead context menu on it either. Same gate as
      // selectElement. A Participant or a Viewer still opens its own menu there
      // (comments, a link), less Edit Text (docs/specs/008-canvas/element-menu-quick-bar.md).
      if (!isReadOnly && lockedByOther(id)) return;
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
    onOpenElementContextMenu: isReadOnly
      ? undefined
      : (id, sx, sy) =>
          // Ellipsis is a toggle: clicking it while its menu is already
          // open for this element closes it (the ContextMenu ignores the
          // trigger's mousedown so this onClick gets to decide).
          setContextMenu((cur) =>
            cur && cur.mode === 'element' && cur.elementId === id
              ? null
              : { mode: 'element', elementId: id, x: sx, y: sy },
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
