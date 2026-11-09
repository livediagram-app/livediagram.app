'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Portal } from '@livehuddle/ui';
import { elementSelector } from '@liveworkspace/workbench/lib/canvas-selectors';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@liveworkspace/workbench/lib/clamp-to-viewport';

// The floating card the Directory and the Elevator open beside themselves (docs/specs/009-elements/directory.md
// "Pressing it", elevator.md "The floor panel"): portalled to the body so it sits over every element, anchored to
// the piece's live rect (which carries the canvas's pan and zoom), beside it on the side with room. It follows the
// piece while open (a walking character's camera moves the board under it), one rect read a frame and only while
// open. Escape closes it (and only it: never Avatar mode too). A press outside it (not on its piece, whose own
// press toggles it) closes it too, unless it is `pinned`: the Directory stays open until its stand is pressed
// again, so you can walk round the canvas while reading it (docs/specs/009-elements/directory.md "Pressing it").
//
// Loaded the first time a piece opens it (docs/specs/016-platform/web-performance.md "A piece's panel"): the faces
// draw it through LazyWayfindingPopover, and what goes inside it is wayfinding-panel-parts.tsx's.

const GAP = 10;

export function WayfindingPopover({
  elementId,
  label,
  width,
  pinned = false,
  onClose,
  children,
}: {
  elementId: string;
  label: string;
  width: number;
  // Stays open through presses outside it, the canvas's walking clicks among them.
  pinned?: boolean;
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
    // Taken in the capture phase and stopped there, so the editor's own Escape (which leaves Avatar mode) never
    // sees the one that closed this.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      close.current();
    };
    const onDown = (e: PointerEvent) => {
      if (pinned) return;
      const target = e.target as Node | null;
      if (!target || cardRef.current?.contains(target)) return;
      if (document.querySelector(elementSelector(elementId))?.contains(target)) return;
      close.current();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [elementId, pinned]);
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
