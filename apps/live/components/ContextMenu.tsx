'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Portal } from './Portal';
import { clampToViewport } from '@/lib/clamp-to-viewport';

// Right-click context menu portal. Mirrors PortalMenu's portal +
// outside-click-close behaviour but anchors at a screen-space (x, y)
// point rather than an HTMLElement bounding rect, which lets the
// editor's right-click handlers open it under the cursor.
//
// Auto-clamps to the viewport so a click in the bottom-right corner
// still surfaces a usable menu instead of clipping off-screen.

type ContextMenuProps = {
  position: { x: number; y: number };
  onClose: () => void;
  children: ReactNode;
  // Drop the menu's vertical padding (and clip children to the rounded
  // corners) so edge-to-edge category sections sit flush top + bottom.
  flush?: boolean;
};

export function ContextMenu({ position, onClose, children, flush = false }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const next = clampToViewport(node.getBoundingClientRect(), adjust);
    if (next.x !== adjust.x || next.y !== adjust.y) setAdjust(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.x, position.y]);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // mousedown for outside-clicks; contextmenu so a SECOND right-click
    // closes the current menu rather than stacking two on top of each
    // other (browsers fire both contextmenu and mousedown for right
    // clicks, and the second contextmenu otherwise leaves the first
    // menu open while the new one opens).
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('contextmenu', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('contextmenu', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <Portal>
      <div
        ref={ref}
        role="menu"
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        className={`fixed z-50 flex w-52 animate-fade-in flex-col rounded-md border border-slate-200 bg-white text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40 ${
          flush ? 'overflow-hidden' : 'py-1'
        }`}
        style={{
          left: position.x + adjust.x,
          top: position.y + adjust.y,
        }}
      >
        {children}
      </div>
    </Portal>
  );
}

// Visual divider between groups of items inside a ContextMenu — keeps
// "Duplicate / Bring to front / Send to back" visually separate from
// the destructive "Delete" item.
export function ContextMenuDivider() {
  return <div role="separator" className="my-1 h-px bg-slate-100 dark:bg-slate-800" />;
}
