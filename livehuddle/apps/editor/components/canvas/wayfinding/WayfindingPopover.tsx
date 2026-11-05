'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Portal, Tooltip } from '@livehuddle/ui';
import { IDENTITY_FILL, identityVars } from '@livehuddle/ui';
import { initialsOf } from '@liveworkspace/model-core/names';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@liveworkspace/workbench/lib/clamp-to-viewport';

// The floating card the Directory and the Elevator open beside themselves (docs/specs/009-elements/directory.md
// "Pressing it", elevator.md "The floor panel"): portalled to the body so it sits over every element, anchored to
// the piece's live rect (which carries the canvas's pan and zoom), beside it on the side with room. It follows the
// piece while open (a walking character's camera moves the board under it), one rect read a frame and only while
// open. Escape or a press outside it (not on its piece, whose own press toggles it) closes it.

const GAP = 10;

export function WayfindingPopover({
  elementId,
  label,
  width,
  onClose,
  children,
}: {
  elementId: string;
  label: string;
  width: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    let last = '';
    const place = () => {
      const anchor = document.querySelector(elementSelector(elementId));
      const card = cardRef.current;
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        const h = card?.offsetHeight ?? 320;
        const right = r.right + GAP + width <= window.innerWidth - EDGE;
        const left = right ? r.right + GAP : Math.max(EDGE, r.left - GAP - width);
        const top = Math.max(EDGE, Math.min(r.top, window.innerHeight - EDGE - h));
        const next = `${Math.round(left)},${Math.round(top)}`;
        if (next !== last) {
          last = next;
          setPos({ left, top });
        }
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [elementId, width]);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target || cardRef.current?.contains(target)) return;
      if (document.querySelector(elementSelector(elementId))?.contains(target)) return;
      close.current();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [elementId]);
  return (
    <Portal>
      <div
        ref={cardRef}
        role="dialog"
        aria-label={label}
        // A portal still bubbles through React to the canvas, where a press in Avatar mode is a walk target (or the
        // start of a drag): a press here belongs to the popover alone.
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-popover)] max-h-[min(70vh,520px)] overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/50"
        style={{
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          width,
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </Portal>
  );
}

/** The card's header: the piece's name and one line under it. */
export function WayfindingHeader({ title, line }: { title: string; line: string }) {
  return (
    <div className="sticky top-0 z-[1] border-b border-slate-100 bg-white/95 px-3.5 pb-2 pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <h2 className="text-[13px] font-semibold leading-tight">{title}</h2>
      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{line}</p>
    </div>
  );
}

const MAX_FACES = 4;

/** Who is somewhere: overlapping initials in each person's colour, then +n. */
export function PeopleChips({
  people,
}: {
  people: readonly { id: string; name: string; color: string; self?: boolean }[];
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, MAX_FACES);
  const names = people.map((p) => (p.self ? `${p.name} (you)` : p.name)).join(', ');
  return (
    <Tooltip label={names}>
      <span className="flex items-center" role="img" tabIndex={0} aria-label={names}>
        {shown.map((p, i) => (
          <span
            key={p.id}
            aria-hidden
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[8.5px] font-semibold text-white ring-2 ring-white dark:ring-slate-900 ${IDENTITY_FILL} ${i > 0 ? '-ml-1.5' : ''}`}
            style={identityVars(p.color)}
          >
            <span className="text-optical-centre">{initialsOf(p.name)}</span>
          </span>
        ))}
        {people.length > MAX_FACES ? (
          <span
            aria-hidden
            className="ml-1 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            +{people.length - MAX_FACES}
          </span>
        ) : null}
      </span>
    </Tooltip>
  );
}

/** A small action on a row: Walk There, Go, a floor's other Elevator. */
export function RowAction({
  children,
  onClick,
  primary = false,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`shrink-0 cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
        primary
          ? 'bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400'
          : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}
