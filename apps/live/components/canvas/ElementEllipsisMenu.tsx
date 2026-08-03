'use client';

import { useEffect, useRef, useState } from 'react';

import { Portal } from '@/components/primitives/Portal';

// A small `…` menu attached to an element's own face.
//
// Extracted from the Done check (spec/137) when the Timer element needed the
// same thing (spec/105): a couple of per-element settings that belong on the
// element rather than three levels into the right-click menu.
//
// PORTALLED, measured from the trigger at open time.
//
// It was inline at first, on the reasoning that a portalled menu would have to
// track a canvas element through pan and zoom. It does not: any pan or zoom
// starts with a pointer-down, which dismisses the menu, so the position only
// has to be right for as long as the menu is open.
//
// Inline was actually wrong for a much more immediate reason. Every element
// that wants this menu clips its own contents — the collab panel, the timer's
// drain fill, the element box's rounded corners — so an inline popover was cut
// off at the element's edge and mostly invisible.

export function ElementEllipsisMenu({
  label,
  color,
  align = 'right',
  children,
}: {
  /** Accessible name for the trigger, e.g. "Timer options". */
  label: string;
  /** Trigger colour, so it sits in the element's own palette. */
  color?: string;
  align?: 'left' | 'right';
  /** Rows. Called with a closer, so picking an option dismisses the menu. */
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Viewport coordinates of the trigger, captured when the menu opens. Fixed
  // positioning from there: see the note above on why tracking is unnecessary.
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const popover = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      // Both refs: the popover is portalled to the body, so it is NOT inside
      // the trigger's subtree and a single containment check would dismiss the
      // menu on every click inside it.
      if (trigger.current?.contains(t) || popover.current?.contains(t)) return;
      setOpen(false);
    };
    // Capture phase: the canvas swallows pointerdown on its own surface, so a
    // bubbling listener never hears the click that should dismiss this.
    window.addEventListener('pointerdown', close, true);
    return () => window.removeEventListener('pointerdown', close, true);
  }, [open]);

  return (
    <div className="pointer-events-auto relative">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        // The canvas reads a press on an element as select-and-maybe-drag, so
        // the trigger has to stop the gesture or opening the menu drags the
        // element out from under it.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          const r = trigger.current?.getBoundingClientRect();
          if (r) setAt({ x: align === 'left' ? r.left : r.right, y: r.bottom + 4 });
          setOpen((v) => !v);
        }}
        // Three drawn dots rather than the `…` character. A text ellipsis
        // sits on the baseline, so in a 20px button it rode the bottom edge
        // instead of the middle however the box was aligned.
        className="flex h-5 w-5 cursor-pointer items-center justify-center rounded transition hover:bg-black/10 dark:hover:bg-white/10"
        style={color ? { color } : undefined}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="3.2" cy="8" r="1.35" />
          <circle cx="8" cy="8" r="1.35" />
          <circle cx="12.8" cy="8" r="1.35" />
        </svg>
      </button>
      {open && at ? (
        <Portal>
          <div
            ref={popover}
            role="menu"
            onPointerDown={(e) => e.stopPropagation()}
            className="fixed z-[var(--z-popover,60)] min-w-[10rem] max-h-[60vh] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            style={{
              top: at.y,
              // Anchored by the edge it opened from, so a menu near the right
              // of the screen opens leftward instead of off it.
              ...(align === 'left' ? { left: at.x } : { right: window.innerWidth - at.x }),
            }}
          >
            {children(() => setOpen(false))}
          </div>
        </Portal>
      ) : null}
    </div>
  );
}

/** One row in an ElementEllipsisMenu. */
export function ElementMenuItem({
  onPress,
  active,
  children,
}: {
  onPress: () => void;
  /** Marks the current value, for menus that pick one of a set. */
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-current={active || undefined}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onPress();
      }}
      className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left text-xs transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
        active
          ? 'font-semibold text-slate-900 dark:text-white'
          : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

/** A heading between groups of rows. */
export function ElementMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
      {children}
    </span>
  );
}
