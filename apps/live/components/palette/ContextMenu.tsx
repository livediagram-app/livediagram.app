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

  // Stamped on mount, not during render (performance.now() is impure, and a
  // re-render must not restamp it); see the grace window below.
  const openedAtRef = useRef(0);
  useEffect(() => {
    openedAtRef.current = performance.now();
  }, []);

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
    // Measured from MOUNT, not from each effect run: `onClose` is an inline
    // callback in most hosts, so it changes identity on every render and the
    // effect re-subscribes. Recomputing the window here meant any re-render
    // (selecting an element, for one) handed the menu a fresh 400ms of
    // immunity — so a left click on an element never dismissed it, and the
    // popover could never come back.
    const openedAt = openedAtRef.current;
    const GRACE_MS = 400;
    // The grace exists for ONE gesture: a mobile long-press, which opens the
    // menu while the finger is still down and then emits its own trailing
    // events on lift. A mouse click is never that, so it dismisses
    // immediately — waiting out an animation before the menu will listen
    // feels broken. Pointer events carry the pointerType that tells them
    // apart; the mouse/contextmenu listeners below have no such luxury and
    // keep the window.
    const onPointer = (e: PointerEvent) => {
      if (!ref.current) return;
      // The secondary button never dismisses: a right press is the START of
      // a menu gesture whose release re-opens (or retargets) this same menu.
      // Closing on the press would tear the menu down and build it again a
      // few frames later — a visible flicker, and the selection popover
      // flashing in the gap.
      if (e.button === 2) return;
      if (e.pointerType === 'touch' && performance.now() - openedAt < GRACE_MS) return;
      if (!(e.target instanceof Node) || ref.current.contains(e.target)) return;
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
    // Only the primary button dismisses. A right-click elsewhere doesn't
    // need to close this menu: there is ONE menu state, so whatever the
    // release opens replaces it — nothing can stack. Listening for
    // `contextmenu` here used to close it on the PRESS (X11 fires that event
    // on mouse-down), and an element's stopPropagation can't prevent it:
    // Next's App Router hydrates on `document`, so React's listeners are
    // document-level siblings of this one and both run regardless.
    // pointerdown carries pointerType, so a mouse click can dismiss the
    // menu the instant it opens while a touch long-press keeps its grace.
    // CAPTURE phase: an element's own pointerdown handler calls
    // stopPropagation, and React's root listener would swallow the event
    // before it ever reached document — capture runs first, so the click
    // that selects is also the click that dismisses.
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
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
