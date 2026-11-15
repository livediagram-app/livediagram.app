'use client';

// The link handle (docs/specs/007-editor/wireframe-pages.md "Setting a link"): a small round handle just outside a
// selected element's bottom-right corner, on a wireframe page. Dragging it draws a line to the pointer and outlines
// the screen under it; letting go on another screen links the element to it. A press without a drag, or Enter,
// opens Link Element on its Screen mode. Drawn in the canvas grips layer, counter-scaled like the quick-connect
// pluses, so it holds its size at any zoom.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { HoverCard } from '@livedesign/ui';
import { pageAt, screenName, type LaidOutPage, type Rect } from '@livedesign/design';
import { ScreenLinkGlyph } from '@/components/canvas/screen-link-glyphs';

// The handle's size, the quick-connect plus's, and its screen-px gap past the corner.
export const SCREEN_LINK_HANDLE_PX = 22;
export const SCREEN_LINK_HANDLE_GAP_PX = 6;
// How far (screen px) a press travels before it is a drag rather than a press.
export const SCREEN_LINK_DRAG_SLOP_PX = 4;
// How far (screen px) the drag's name pill keeps from the window's edges when its screen's corner is off screen.
export const SCREEN_LINK_PILL_MARGIN_PX = 8;

type Box = { left: number; top: number; right: number; bottom: number };

/** The shift (screen px) that brings a box `margin` inside a `width` x `height` window; a box wider or taller than
 *  the window keeps its left or top edge in. */
export function pillShift(box: Box, width: number, height: number, margin: number) {
  const along = (lo: number, hi: number, size: number) =>
    lo < margin ? margin - lo : hi > size - margin ? Math.max(size - margin - hi, margin - lo) : 0;
  return { x: along(box.left, box.right, width), y: along(box.top, box.bottom, height) };
}

type Press = {
  pointerId: number;
  clientX: number;
  clientY: number;
  dragging: boolean;
};

type Drag = { x: number; y: number; target: LaidOutPage | null };

/** The screen a drop at `point` links to: a page of the tab, never the element's own. */
export function dropTarget(
  pages: readonly LaidOutPage[],
  point: { x: number; y: number },
  ownPageId: string | undefined,
): LaidOutPage | null {
  const page = pageAt(pages, point);
  return page && page.id !== ownPageId ? page : null;
}

export function ScreenLinkHandle({
  elementId,
  bounds,
  zoom,
  pages,
  ownPageId,
  onLink,
  onPick,
}: {
  elementId: string;
  // The selected element's box, in canvas coords.
  bounds: Rect;
  zoom: number;
  pages: readonly LaidOutPage[];
  // The page the element sits on: dropping back on it changes nothing.
  ownPageId: string | undefined;
  onLink: (elementId: string, pageId: string) => void;
  onPick: (elementId: string) => void;
}) {
  const pressRef = useRef<Press | null>(null);
  // A drag's release still fires a click; it is swallowed so the menu doesn't open over the link just made.
  const draggedRef = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);

  // The handle's centre in canvas coords: past the corner by the gap and half the handle, held in screen px.
  const reach = (SCREEN_LINK_HANDLE_GAP_PX + SCREEN_LINK_HANDLE_PX / 2) / zoom;
  const hx = bounds.x + bounds.width + reach;
  const hy = bounds.y + bounds.height + reach;

  const cancel = () => {
    pressRef.current = null;
    setDrag(null);
  };

  // Escape drops a drag in progress, as it does every canvas drag.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      draggedRef.current = true;
      cancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [dragging]);

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    // The handle's own gesture: no element drag, no marquee, no deselect under it.
    e.stopPropagation();
    draggedRef.current = false;
    pressRef.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      dragging: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== e.pointerId) return;
    const dx = e.clientX - press.clientX;
    const dy = e.clientY - press.clientY;
    if (!press.dragging && Math.hypot(dx, dy) < SCREEN_LINK_DRAG_SLOP_PX) return;
    press.dragging = true;
    // The pointer's canvas point: the handle's plus the client travel over the zoom (the view holds still).
    const x = hx + dx / zoom;
    const y = hy + dy / zoom;
    setDrag({ x, y, target: dropTarget(pages, { x, y }, ownPageId) });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== e.pointerId) return;
    if (press.dragging) {
      draggedRef.current = true;
      const x = hx + (e.clientX - press.clientX) / zoom;
      const y = hy + (e.clientY - press.clientY) / zoom;
      const target = dropTarget(pages, { x, y }, ownPageId);
      if (target) onLink(elementId, target.id);
    }
    cancel();
  };

  return (
    <>
      {drag ? <ScreenLinkDragLine from={{ x: hx, y: hy }} drag={drag} zoom={zoom} /> : null}
      <div
        data-screen-link-handle=""
        className="pointer-events-none absolute z-[var(--z-toolbar)]"
        style={{
          left: hx,
          top: hy,
          transform: `translate(-50%, -50%) scale(${1 / zoom})`,
        }}
      >
        <HoverCard
          title="Link to a Screen"
          description="Drag onto another screen, or click to pick one."
          disabled={dragging}
          className="pointer-events-auto"
        >
          <button
            type="button"
            aria-label="Link to a screen"
            className="flex cursor-grab touch-none items-center justify-center rounded-full border-2 border-white bg-brand-700 text-white shadow-lg shadow-slate-900/20 transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 active:cursor-grabbing dark:border-slate-900 dark:bg-brand-600 dark:shadow-slate-950/40 dark:hover:bg-brand-500"
            style={{ width: SCREEN_LINK_HANDLE_PX, height: SCREEN_LINK_HANDLE_PX }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={cancel}
            onLostPointerCapture={() => {
              if (pressRef.current?.dragging) cancel();
            }}
            onClick={() => {
              if (draggedRef.current) {
                draggedRef.current = false;
                return;
              }
              onPick(elementId);
            }}
          >
            <ScreenLinkGlyph size={12} />
          </button>
        </HoverCard>
      </div>
    </>
  );
}

// The line from the handle to the pointer, and the screen it would link to outlined with its name. Canvas chrome in
// canvas coords, its strokes held in screen px; never an element.
function ScreenLinkDragLine({
  from,
  drag,
  zoom,
}: {
  from: { x: number; y: number };
  drag: Drag;
  zoom: number;
}) {
  const { x, y, target } = drag;
  // A horizontal-leaning curve, as a prototype's noodle reads: the pull grows with the distance travelled.
  const pull = Math.max(40 / zoom, Math.abs(x - from.x) / 2);
  const d = `M ${from.x} ${from.y} C ${from.x + pull} ${from.y}, ${x - pull} ${y}, ${x} ${y}`;
  const stroke = target ? 'var(--color-brand-500)' : 'var(--color-slate-400)';
  // The name pill kept inside the window: measured after each layout and shifted by what keeps it in, written straight
  // to the wrapper so a drag frame never re-renders for it.
  const shiftRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const applied = useRef({ x: 0, y: 0 });
  useLayoutEffect(() => {
    const wrap = shiftRef.current;
    const pill = pillRef.current;
    if (!wrap || !pill) {
      applied.current = { x: 0, y: 0 };
      return;
    }
    const r = pill.getBoundingClientRect();
    const was = applied.current;
    const next = pillShift(
      {
        left: r.left - was.x,
        top: r.top - was.y,
        right: r.right - was.x,
        bottom: r.bottom - was.y,
      },
      window.innerWidth,
      window.innerHeight,
      SCREEN_LINK_PILL_MARGIN_PX,
    );
    if (next.x === was.x && next.y === was.y) return;
    applied.current = next;
    wrap.style.transform = next.x || next.y ? `translate(${next.x}px, ${next.y}px)` : '';
  });
  return (
    <>
      <svg
        aria-hidden
        data-screen-link-drag=""
        className="pointer-events-none absolute left-0 top-0 z-[var(--z-toolbar)] h-px w-px overflow-visible"
      >
        {target ? (
          <rect
            x={target.rect.x}
            y={target.rect.y}
            width={target.rect.width}
            height={target.rect.height}
            rx={8 / zoom}
            fill="var(--color-brand-500)"
            fillOpacity={0.06}
            stroke="var(--color-brand-500)"
            strokeWidth={2 / zoom}
          />
        ) : null}
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={2 / zoom}
          strokeLinecap="round"
          strokeDasharray={target ? undefined : `${6 / zoom} ${4 / zoom}`}
        />
        <circle cx={x} cy={y} r={4 / zoom} fill={stroke} />
      </svg>
      {target ? (
        // Above the screen's top-left corner, held in screen px: the scale is the outer box's, the lift the inner's
        // own height, so the pill sits clear of the screen at any zoom.
        <div
          className="pointer-events-none absolute z-[var(--z-toolbar)]"
          style={{
            left: target.rect.x,
            top: target.rect.y - 6 / zoom,
            transform: `scale(${1 / zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <div ref={shiftRef} data-screen-link-target-shift="">
            <div
              ref={pillRef}
              data-screen-link-target=""
              className="-translate-y-full whitespace-nowrap rounded-md bg-brand-700 px-2 py-1 text-xs font-semibold text-white shadow-md dark:bg-brand-600"
            >
              Link to {screenName(target, target.index)}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
