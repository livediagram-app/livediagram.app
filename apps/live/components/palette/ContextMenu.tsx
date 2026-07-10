'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Portal } from '@/components/primitives/Portal';
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
  // Grow UPWARD from `position.y` (its bottom edge sits at y) instead of
  // downward. Used when the trigger is at the bottom of the screen (the
  // footer canvas-menu button) so the menu opens above it, not over it.
  anchorBottom?: boolean;
};

export function ContextMenu({
  position,
  onClose,
  children,
  flush = false,
  anchorBottom = false,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Re-clamp on mount, on a new anchor, AND whenever the menu's size
    // changes — expanding a collapsible category grows it downward and would
    // otherwise spill past the viewport bottom (the clamp shifts it up to
    // fit). The functional update reads the latest adjust so the natural-edge
    // maths in clampToViewport stays correct, and returns prev unchanged to
    // avoid a setState loop.
    const recompute = () => {
      setAdjust((prev) => {
        const next = clampToViewport(node.getBoundingClientRect(), prev);
        return next.x === prev.x && next.y === prev.y ? prev : next;
      });
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(node);
    return () => ro.disconnect();
  }, [position.x, position.y]);

  useEffect(() => {
    // Grace window after the menu opens during which outside mouse /
    // contextmenu events are ignored. A mobile long-press opens this menu
    // while the finger is still down, and the same gesture then emits a
    // native `contextmenu` (Android) plus trailing synthetic mouse events
    // on lift — all within a few hundred ms. Without this guard those land
    // on the just-mounted dismiss listeners and close the menu the instant
    // it appears. Desktop right-click is unaffected: its mousedown fires
    // before the contextmenu that opens the menu, so nothing arrives during
    // the window. Escape (below) is never graced.
    const openedAt = performance.now();
    const GRACE_MS = 400;
    const onMouse = (e: MouseEvent) => {
      if (!ref.current) return;
      if (performance.now() - openedAt < GRACE_MS) return;
      if (!(e.target instanceof Node) || ref.current.contains(e.target)) return;
      // A mousedown on the button that OPENED this menu must not trip the
      // outside-close, or the button's own click would just reopen it. The
      // trigger marks itself with data-context-menu-trigger and toggles the
      // menu in its onClick instead. A MenuFlyoutSection's panel is portalled
      // outside this menu but marks itself data-menu-flyout, so interacting
      // with it counts as inside the menu. Clicks anywhere else close as usual.
      // While a label is being edited the menu rides alongside the editor
      // (spec/09): clicks inside the editing session (the contentEditable
      // or its floating toolbar) must not dismiss it — the user is moving
      // the caret / formatting text, not clicking away.
      // [data-tour-popover] (spec/79): the tour anchors its card to this
      // menu while explaining it, so its buttons don't count as outside.
      if (
        e.target instanceof Element &&
        e.target.closest(
          '[data-context-menu-trigger],[data-menu-flyout],[data-rich-text-session],[data-tour-popover]',
        )
      )
        return;
      onClose();
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
        data-tour-id="context-menu"
        // Marks the menu for the rich-text editor's focus-preservation
        // capture listener (spec/09): mousedown inside is preventDefaulted
        // while editing so menu clicks never blur the editor.
        data-context-menu=""
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        // lvd-menu-stagger cascades the direct children (categories / items)
        // in one at a time for a falling-stack entrance (see globals.css).
        className={`lvd-menu-stagger fixed z-[var(--z-overlay)] flex w-56 animate-fade-in flex-col rounded-md border border-slate-200 bg-white/90 text-sm shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-slate-950/40 ${
          flush ? 'overflow-hidden' : 'py-1'
        }`}
        style={{
          left: position.x + adjust.x,
          top: position.y + adjust.y,
          transform: anchorBottom ? 'translateY(-100%)' : undefined,
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
