'use client';

// The one thing you can do to an element somebody else is holding (docs/specs/007-editor/live-app.md
// concurrent-selection lock + docs/specs/012-collaboration/facilitator.md facilitator): free it.
//
// Its own menu rather than a row in the element's real context menu, because
// the element is still LOCKED. Every other row in that menu edits something,
// and the lock's whole job is to stop two people doing that at once — so a
// menu that offered them would be a menu of dead options with one live one.
// Right-clicking a locked element used to open nothing at all; this is the
// narrow exception, and it stays narrow.
//
// Positioned at the click, like the context menu it stands in for, and clamped
// so a right-click near an edge does not open it off-screen.

import { useEffect, useRef } from 'react';
import { Portal } from '@/components/primitives/Portal';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';

const WIDTH = 236;

export type LockHolder = { id: string; name: string; color: string };

export function LockedElementMenu({
  at,
  holders,
  onRelease,
  onClose,
}: {
  /** Viewport coordinates of the right-click. */
  at: { x: number; y: number };
  /** Who is holding this element. Never empty — the host only opens it then. */
  holders: readonly LockHolder[];
  /** Free this person's hold. */
  onRelease: (presenceId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Capture, like every other canvas popover: the canvas swallows pointerdown
    // on its own surface, so a bubbling listener never hears the click that
    // should dismiss this.
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [onClose]);

  const left = Math.min(at.x, window.innerWidth - WIDTH - EDGE);
  const top = Math.min(at.y, window.innerHeight - 40 * holders.length - 60 - EDGE);

  return (
    <Portal>
      <div
        ref={ref}
        role="menu"
        aria-label="Locked element"
        // The canvas reads a press as select-and-maybe-drag, and a portal's
        // events still bubble up the REACT tree to the canvas that rendered
        // this — the same trap ElementEllipsisMenu documents.
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        style={{ left, top, width: WIDTH }}
        className="fixed z-[var(--z-overlay,50)] rounded-lg border border-slate-200 bg-white py-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          In use
        </p>
        {holders.map((holder) => (
          <button
            key={holder.id}
            type="button"
            role="menuitem"
            onClick={() => {
              onRelease(holder.id);
              onClose();
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: holder.color }}
            />
            {/* The name is the point: "free it" without saying whose hold you
                are breaking is an action you cannot judge before taking. */}
            <span className="truncate">Release {holder.name}&rsquo;s hold</span>
          </button>
        ))}
        <p className="px-3 pt-1 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
          They keep their work — it just stops being theirs to edit.
        </p>
      </div>
    </Portal>
  );
}
