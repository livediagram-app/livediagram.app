'use client';

// The view dial (docs/specs/008-canvas/3d-view.md "The view dial"): one round control for the camera. Up and down
// zoom (a press steps, holding glides), left and right turn the 3D view a quarter turn, the middle shows the zoom
// (click fits, hover offers levels), the wheel over it zooms, and dragging its middle zooms or turns.

import { useEffect, useRef, type ReactNode } from 'react';
import { HoverCard, Glyph } from '@livehuddle/ui';
import { ZoomMenu } from '@/components/chrome/ZoomMenu';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas';

type Props = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoom: (zoom: number) => void;
  onFitToScreen: () => void;
  /** Turns the camera a quarter turn, or null when the view cannot turn (flat, or Rotate in 3D View off). */
  onTurn: ((by: -1 | 1) => void) | null;
};

/** How long a press is held before it glides, and how fast the glide zooms (per second, as a factor). */
const HOLD_MS = 320;
const GLIDE_PER_S = 1.9;
/** How far the middle is dragged before a sideways drag turns, and px of vertical drag per doubling of zoom. */
const TURN_PX = 28;
const DOUBLE_PX = 120;

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function ViewDial({ zoom, onZoomIn, onZoomOut, onSetZoom, onFitToScreen, onTurn }: Props) {
  const zoomNow = useLatest(zoom);
  const setRef = useLatest(onSetZoom);
  const glide = useRef<{ timer: number; raf: number } | null>(null);
  const stopGlide = () => {
    if (!glide.current) return;
    clearTimeout(glide.current.timer);
    cancelAnimationFrame(glide.current.raf);
    glide.current = null;
  };
  useEffect(() => stopGlide, []);

  // A press steps at once; held past HOLD_MS it glides on, frame by frame, until released.
  const holdZoom = (dir: 1 | -1) => {
    stopGlide();
    if (dir > 0) onZoomIn();
    else onZoomOut();
    const g = { timer: 0, raf: 0 };
    g.timer = window.setTimeout(() => {
      let last = performance.now();
      const step = (now: number) => {
        const dt = (now - last) / 1000;
        last = now;
        const next = clampZoom(zoomNow.current * GLIDE_PER_S ** (dir * dt));
        if (next !== zoomNow.current) setRef.current(next);
        g.raf = requestAnimationFrame(step);
      };
      g.raf = requestAnimationFrame(step);
    }, HOLD_MS);
    glide.current = g;
  };

  // The wheel over the dial zooms, without scrolling the page or the canvas under it.
  const dialRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dialRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setRef.current(clampZoom(zoomNow.current * 2 ** (-e.deltaY / 400)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomNow, setRef]);

  // Dragging the middle: up and down zoom smoothly; sideways past TURN_PX turns once per drag.
  const drag = useRef<{
    x: number;
    y: number;
    zoom: number;
    turned: boolean;
    moved: boolean;
  } | null>(null);
  const onKnobDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      zoom: zoomNow.current,
      turned: false,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onKnobMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    if (Math.abs(dy) >= Math.abs(dx)) setRef.current(clampZoom(d.zoom * 2 ** (-dy / DOUBLE_PX)));
    else if (!d.turned && onTurn && Math.abs(dx) > TURN_PX) {
      d.turned = true;
      onTurn(dx > 0 ? 1 : -1);
    }
  };
  const onKnobUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    // A drag is not a click on the middle's zoom button.
    if (d?.moved) {
      e.preventDefault();
      const swallow = (c: Event) => {
        c.stopPropagation();
        c.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    }
  };

  return (
    <div
      ref={dialRef}
      data-view-dial=""
      data-zoom-controls=""
      role="group"
      aria-label="View"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="pointer-events-auto relative h-32 w-32 animate-fade-in select-none rounded-full border border-slate-200 bg-white/95 shadow-lg shadow-slate-900/10 ring-1 ring-white/70 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-slate-950/40 dark:ring-white/5"
    >
      {/* The ring's groove, so the four arrows read as one dial round the middle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[12px] rounded-full bg-gradient-to-b from-slate-100 to-slate-50 shadow-[inset_0_1px_3px_rgba(15,23,42,0.12)] dark:from-slate-800 dark:to-slate-900 dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]"
      />
      <Arrow
        at="top"
        label="Zoom In"
        description="Bring the camera closer. Hold to keep zooming."
        onDown={() => holdZoom(1)}
        onUp={stopGlide}
      >
        <path d="M4 9.5 7 6.5l3 3" />
      </Arrow>
      <Arrow
        at="bottom"
        label="Zoom Out"
        description="Lift the camera higher. Hold to keep zooming."
        onDown={() => holdZoom(-1)}
        onUp={stopGlide}
      >
        <path d="M4 5.5 7 8.5l3-3" />
      </Arrow>
      {onTurn ? (
        <>
          <Arrow
            at="left"
            label="Turn Left"
            description="Turn the camera a quarter turn to the left. [."
            onDown={() => onTurn(-1)}
          >
            <path d="M9.5 4 6.5 7l3 3" />
          </Arrow>
          <Arrow
            at="right"
            label="Turn Right"
            description="Turn the camera a quarter turn to the right. ]."
            onDown={() => onTurn(1)}
          >
            <path d="M5.5 4 8.5 7l-3 3" />
          </Arrow>
        </>
      ) : null}
      {/* The middle: the zoom, click to fit, hover for levels; drag it to zoom or turn. */}
      <div
        onPointerDown={onKnobDown}
        onPointerMove={onKnobMove}
        onPointerUp={onKnobUp}
        onPointerCancel={() => (drag.current = null)}
        className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full border border-slate-200 bg-white shadow-md shadow-slate-900/10 active:cursor-grabbing dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="[&_button]:h-10 [&_button]:min-w-0 [&_button]:rounded-full [&_button]:px-1 [&_button]:text-xs">
          <ZoomMenu zoom={zoom} onSetZoom={onSetZoom} onFitToScreen={onFitToScreen} />
        </div>
      </div>
    </div>
  );
}

const PLACE = {
  top: 'left-1/2 top-[3px] -translate-x-1/2',
  bottom: 'bottom-[3px] left-1/2 -translate-x-1/2',
  left: 'left-[3px] top-1/2 -translate-y-1/2',
  right: 'right-[3px] top-1/2 -translate-y-1/2',
} as const;

function Arrow({
  at,
  label,
  description,
  onDown,
  onUp,
  children,
}: {
  at: keyof typeof PLACE;
  label: string;
  description: string;
  onDown: () => void;
  onUp?: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`absolute ${PLACE[at]}`}>
      <HoverCard title={label} description={description}>
        <button
          type="button"
          aria-label={label}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            onDown();
          }}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            onDown();
            onUp?.();
          }}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 active:scale-90 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white dark:active:bg-slate-600"
        >
          <Glyph size={18} units={14}>
            {children}
          </Glyph>
        </button>
      </HoverCard>
    </div>
  );
}
