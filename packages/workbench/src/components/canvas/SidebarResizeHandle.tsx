'use client';

// The drag handle down a left sidebar's right edge (liveworkspace/docs/specs/011-workbench/sidebar-width.md
// "Resizing"): drag to set the width live, double-click or Enter for the default, arrow keys in 8 px steps (32 with
// Shift), Home and End to the bounds, Escape mid-drag back to where it began. A focusable vertical separator; none on a
// touch-only device, which has no pointer to aim at the edge.
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { Tooltip } from '@liveworkspace/ui';
import { useCoarsePointer } from '../../hooks/ui/useCoarsePointer';
import {
  clampSidebarWidth,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_KEY_STEP,
  SIDEBAR_WIDTH_KEY_STEP_LARGE,
} from '../../lib/sidebar-width';

type Drag = { pointerId: number; x: number; start: number; next: number; frame: number };

/** What the page wears while a handle is dragged: the resize cursor everywhere, and no text selection. */
function dragCursor(on: boolean): void {
  const style = document.documentElement.style;
  style.cursor = on ? 'col-resize' : '';
  style.userSelect = on ? 'none' : '';
}

export function SidebarResizeHandle({
  label,
  width,
  scale,
  onResize,
  onCommit,
  onReset,
  onCancel,
}: {
  // The separator's name: "Resize Contents", "Resize Pages".
  label: string;
  // The sidebar's width now, px at the panels' UI scale.
  width: number;
  // The panels' UI scale: a pointer moves screen px, the width is at the scale.
  scale: number;
  // A live width while dragging, not yet kept.
  onResize: (width: number) => void;
  // The width to keep: a drag's end, a key.
  onCommit: (width: number) => void;
  // Back to the default.
  onReset: () => void;
  // A drag given up: back to the width last kept.
  onCancel: () => void;
}) {
  const coarse = useCoarsePointer();
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);

  // A handle unmounted mid-drag (the sidebar collapsed, the page left) gives the page its cursor back.
  useEffect(
    () => () => {
      if (!drag.current) return;
      cancelAnimationFrame(drag.current.frame);
      dragCursor(false);
    },
    [],
  );

  const end = (keep: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    cancelAnimationFrame(d.frame);
    dragCursor(false);
    setDragging(false);
    if (keep) onCommit(d.next);
    else onCancel();
  };

  // Escape gives a drag up. Heard on the document: a press on the handle takes no focus (no ring for a mouse), so the
  // handle itself never sees the key.
  const giveUp = useEffectEvent(() => end(false));
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      giveUp();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [dragging]);

  if (coarse) return null;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { pointerId: e.pointerId, x: e.clientX, start: width, next: width, frame: 0 };
    dragCursor(true);
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    d.next = clampSidebarWidth(d.start + (e.clientX - d.x) / scale);
    // Once a frame however fast the pointer reports: the chrome beside the sidebar renders with it.
    if (d.frame) return;
    d.frame = requestAnimationFrame(() => {
      d.frame = 0;
      onResize(d.next);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? SIDEBAR_WIDTH_KEY_STEP_LARGE : SIDEBAR_WIDTH_KEY_STEP;
    const next =
      e.key === 'ArrowLeft'
        ? width - step
        : e.key === 'ArrowRight'
          ? width + step
          : e.key === 'Home'
            ? SIDEBAR_MIN_WIDTH
            : e.key === 'End'
              ? SIDEBAR_MAX_WIDTH
              : null;
    if (next === null && e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    if (next === null) onReset();
    else onCommit(clampSidebarWidth(next));
  };

  return (
    <Tooltip label={label}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-description="Drag to resize. Double-click to reset."
        aria-valuenow={width}
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuetext={`${width} pixels`}
        tabIndex={0}
        data-sidebar-resize=""
        data-dragging={dragging ? '' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          if (drag.current?.pointerId === e.pointerId) end(true);
        }}
        onPointerCancel={() => end(false)}
        onLostPointerCapture={() => end(true)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onReset();
        }}
        onKeyDown={onKeyDown}
        className="group/resize absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize touch-none outline-none"
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 w-0.5 bg-brand-500 transition-opacity duration-micro group-hover/resize:opacity-100 group-hover/resize:delay-100 group-focus-visible/resize:opacity-100 group-focus-visible/resize:delay-0 motion-reduce:transition-none dark:bg-brand-400 ${
            dragging ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    </Tooltip>
  );
}
