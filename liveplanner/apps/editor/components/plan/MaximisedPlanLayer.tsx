'use client';

// A maximised Plan element (docs/specs/026-plan/plan-board.md "Maximised board", plan-views.md "Maximised view"):
// a board's or a visualisation's body drawn over the canvas area, under the editor's chrome, for this person only. The body is always
// rendered through a portal into one host element of its own (MaximisableSlot), and only that host moves: into its
// slot on the canvas, or into the overlay's box while maximised. So maximising and restoring never remount the body
// (a Gantt keeps its scale, window and collapsed lanes; a drag in flight survives), and PlanContext and the canvas
// surface still reach it. While maximised, its presses stop at the slot so the canvas never selects or moves the
// element underneath.
import { useCanvasMenu } from '@liveworkspace/workbench/components/canvas/canvas-menu-context';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { MaximizeIcon, MinimizeIcon, Tooltip } from '@liveplanner/ui';
import {
  maximisePlanElement,
  restorePlanElement,
  useMaximisedPlanClosing,
  type MaximisedKind,
} from '@/hooks/plan/maximised-plan';
import { useFaceFinish } from '@liveworkspace/workbench/components/canvas/CanvasFinishContext';
import { useFaceFinishPass } from '@/components/canvas/useFaceFinishPass';
import { SketchFace } from '@liveworkspace/workbench/components/canvas/SketchFace';
import { liveFiltersRedrawOnRepaint } from '@liveworkspace/workbench/lib/live-filter-cost';
import { useCanvasLayerInsets } from '@/hooks/ui/useCanvasLayerInsets';
import { announceHeaderBand } from './menu-name-slot';
import type { PlanPalette } from './plan-palette';
import { type BandBlend, CanvasCover, stop, useCanvasRoot } from './CanvasCover';
import { closeBox, openBox, useReportedBoxSize } from './maximise-motion';

export { CanvasCover } from './CanvasCover';
export {
  escapeRestores,
  flipTransform,
  openBox,
  originOf,
  useMaximisedPlanLifetime,
} from './maximise-motion';

const HOST_CLASS = 'absolute inset-0';

// A board's or a view's place: the body rendered once, through a portal into its own host element, which sits in
// this slot on the canvas or, while maximised, in the overlay. `placeholder` styles the empty slot while the body is
// away; `onMaximisedSize` hears the overlay box's size (a view lays itself out at it, not the element's).
export function MaximisableSlot({
  id,
  maximised,
  fill = false,
  placeholder,
  onMaximisedSize,
  tint,
  blend,
  children,
}: {
  id: string;
  maximised: boolean;
  // Filling its tab (docs/specs/026-plan/plan-board.md "Fill Tab"): drawn over the canvas area, under the editor's
  // chrome, at once (no grow), rather than over the whole screen. Takes `maximised`'s place.
  fill?: boolean;
  placeholder: CSSProperties;
  onMaximisedSize?: (size: { width: number; height: number } | null) => void;
  // The element's hue for the chrome in its header band (planBandTint), or its own surface and border (blend).
  tint?: string | undefined;
  blend?: BandBlend | undefined;
  children: ReactNode;
}) {
  const [host] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.className = HOST_CLASS;
    return el;
  });
  const slotRef = useRef<HTMLDivElement>(null);
  const openCanvasMenu = useCanvasMenu();
  // On the canvas: the host back in its slot (the overlay puts it in its box while maximised).
  const over = maximised || fill;
  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!over && host && slot && host.parentElement !== slot) {
      slot.appendChild(host);
      announceHeaderBand();
    }
  }, [over, host]);
  useEffect(() => () => host?.remove(), [host]);
  if (!host) return <>{children}</>;
  return (
    <div
      ref={slotRef}
      data-plan-slot={id}
      className={HOST_CLASS}
      style={over ? placeholder : undefined}
      // The body's presses reach this slot through the portal: while maximised they stop here, so the canvas
      // element underneath is never selected, moved or menu'd from the overlay.
      onPointerDown={over ? stop : undefined}
      onDoubleClick={over ? stop : undefined}
      // A right-click on the body's empty space (a card's own menu stops it first) opens the tab's menu, as the
      // canvas's does, never the browser's.
      onContextMenu={
        over
          ? (e) => {
              e.stopPropagation();
              if (e.defaultPrevented || !openCanvasMenu) return;
              e.preventDefault();
              openCanvasMenu(e.clientX, e.clientY);
            }
          : undefined
      }
      onWheel={over ? stop : undefined}
    >
      {createPortal(
        <OverFace id={id} over={over}>
          {children}
        </OverFace>,
        host,
      )}
      {fill ? (
        <FilledTabLayer
          host={host}
          tint={tint}
          blend={blend}
          {...(onMaximisedSize ? { onSize: onMaximisedSize } : {})}
        />
      ) : maximised ? (
        <MaximisedPlanLayer
          id={id}
          host={host}
          tint={tint}
          blend={blend}
          {...(onMaximisedSize ? { onSize: onMaximisedSize } : {})}
        />
      ) : null}
    </div>
  );
}

// The body's face while it is drawn over the canvas (docs/specs/008-canvas/finish.md "Every other face is drawn by hand
// too"): out of its element's box it is out of the element's SketchFace and data-face-finish too, so it takes its own
// (the face finish reaches it through the portal as context). On the canvas the element's carry it and this stays
// inactive. One tree both ways, so the board never remounts.
function OverFace({ id, over, children }: { id: string; over: boolean; children: ReactNode }) {
  const finish = useFaceFinish();
  const ref = useRef<HTMLDivElement>(null);
  useFaceFinishPass(ref, over ? finish : undefined, id, { page: true });
  return (
    <div
      ref={ref}
      className={HOST_CLASS}
      data-face-finish={over && finish !== 'flexible' ? finish : undefined}
    >
      <SketchFace active={over && finish === 'sketch' && !liveFiltersRedrawOnRepaint()} keepTree>
        {children}
      </SketchFace>
    </div>
  );
}

// Opening (a container transform): an empty frame (GHOST_CLASSES, no text, so never blurred by the scale) grows from
// the element's place to fill the screen. The content overlaps the grow's tail: the host moves into the box and
// fades in over the last REVEAL_MS (the frame is all but full size by then on this ease), so the whole maximise
// settles within MOTION_MS.long; the frame drops its ghost surface once the grow ends. Returns the cancel, which
// drops whatever is still pending and never reveals: restoring, or the layer going, takes the host from here.
export function MaximisedPlanLayer({
  id,
  host,
  onSize,
  tint,
  blend,
}: {
  id: string;
  host: HTMLElement;
  tint?: string | undefined;
  blend?: BandBlend | undefined;
  onSize?: (size: { width: number; height: number } | null) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const closing = useMaximisedPlanClosing();
  const [mark, canvas] = useCanvasRoot();
  // Clear of the chrome over the canvas: the top row (or holding it in the header band), side panels.
  const layout = useCanvasLayerInsets(canvas);

  // One phase at a time, opening or closing, in one effect: when restoring begins (or the layer goes), the opening's
  // cleanup cancels its pending reveal and settle (timers and listener) without running them, so an opening still
  // under way can never move the host back into the shrinking box; and maximising again while it shrinks back runs
  // the opening afresh.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    return closing ? closeBox(box, id, host) : openBox(box, id, host);
  }, [closing, id, host, canvas]);

  useReportedBoxSize(boxRef, onSize, canvas);

  if (typeof document === 'undefined') return null;
  return (
    <>
      <span hidden ref={mark} />
      {canvas
        ? createPortal(
            <CanvasCover
              layout={layout}
              marker={{ 'data-maximised-board': '' }}
              tint={tint}
              blend={blend}
            >
              <div
                ref={boxRef}
                className="relative h-full w-full origin-top-left will-change-transform"
              />
            </CanvasCover>,
            canvas,
          )
        : null}
    </>
  );
}

// The layer a board filling its tab moves its host into: the canvas area, as a maximised element's, at once (no
// grow). Presses stop here, as on a maximised board.
function FilledTabLayer({
  host,
  tint,
  blend,
  onSize,
}: {
  host: HTMLElement;
  tint?: string | undefined;
  blend?: BandBlend | undefined;
  // The layer's size, for a view to lay itself out at (a Visualisation tab's chart).
  onSize?: ((size: { width: number; height: number } | null) => void) | undefined;
}) {
  const [mark, canvas] = useCanvasRoot();
  const boxRef = useRef<HTMLDivElement>(null);
  // The host goes into the box first (this effect runs before the measure below), so the first measure, made before
  // the first paint, finds the header's controls card there.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box && host.parentElement !== box) {
      box.appendChild(host);
      announceHeaderBand();
    }
  }, [canvas, host]);
  // Clear of the chrome over the canvas: the top row (or holding it in the header band), side panels.
  const layout = useCanvasLayerInsets(canvas);
  useReportedBoxSize(boxRef, onSize, canvas);
  return (
    <>
      <span hidden ref={mark} />
      {canvas
        ? createPortal(
            <CanvasCover
              layout={layout}
              marker={{ 'data-fill-tab-board': '' }}
              tint={tint}
              blend={blend}
              enter
            >
              <div ref={boxRef} className="relative h-full w-full" />
            </CanvasCover>,
            canvas,
          )
        : null}
    </>
  );
}

// The header's Maximise Board / Restore Board (or Maximise View / Restore View), at its top right.
export function MaximisePlanButton({
  id,
  kind = 'Board',
  maximised,
  palette,
  small = false,
}: {
  id: string;
  kind?: MaximisedKind;
  maximised: boolean;
  palette: PlanPalette;
  // The visualisations' header controls are 24 px; a board's header buttons 32 px.
  small?: boolean;
}) {
  const label = maximised ? `Restore ${kind}` : `Maximise ${kind}`;
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={maximised}
        className={`flex shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10 ${small ? 'h-6 w-6' : 'h-8 w-8'}`}
        style={{ color: palette.muted }}
        onPointerDown={stop}
        onClick={(e) => {
          e.stopPropagation();
          if (maximised) restorePlanElement();
          else maximisePlanElement(id, kind);
        }}
      >
        {maximised ? (
          <MinimizeIcon size={small ? 14 : 16} />
        ) : (
          <MaximizeIcon size={small ? 14 : 16} />
        )}
      </button>
    </Tooltip>
  );
}
