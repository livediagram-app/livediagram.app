'use client';

// A maximised Plan element (docs/specs/026-plan/plan-board.md "Maximised board", plan-views.md "Maximised view"):
// a board's or a visualisation's body drawn over the canvas area, under the editor's chrome, for this person only. The body is always
// rendered through a portal into one host element of its own (MaximisableSlot), and only that host moves: into its
// slot on the canvas, or into the overlay's box while maximised. So maximising and restoring never remount the body
// (a Gantt keeps its scale, window and collapsed lanes; a drag in flight survives), and PlanContext and the canvas
// surface still reach it. While maximised, its presses stop at the slot so the canvas never selects or moves the
// element underneath.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { MENU_SURFACE_ATTR, MaximizeIcon, MinimizeIcon, Tooltip } from '@livediagram/ui';
import {
  finishRestore,
  maximisePlanElement,
  releasePlanElement,
  restorePlanElement,
  useMaximisedPlanClosing,
  type MaximisedKind,
} from '@/hooks/plan/maximised-plan';
import { MOTION_MS } from '@livediagram/tailwind-config/motion';
import { prefersReducedMotion } from '@/lib/motion-preference';
import { useCanvasLayerInsets } from '@/hooks/ui/useCanvasLayerInsets';
import type { CanvasLayout } from '@/lib/canvas-layer-insets';
import type { PlanPalette } from './plan-palette';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// A maximised or tab-filling element is drawn over the canvas area (the canvas's own `main`), over its content, inset
// clear of the chrome laid over the canvas (the Toolbar layout's top row, side panels, the zoom controls:
// useCanvasLayerInsets), with the header, tab bar and footer outside `main`: docs/specs/026-plan/plan-board.md
// "Maximised board", "Fill Tab". Under the panels too, should one be dragged over it.
export const CANVAS_LAYER_Z = 'z-[calc(var(--z-panel)-1)]';

// The cover over the whole canvas area while a Plan element is maximised or fills its tab: painted with the canvas's
// background so nothing under it shows, and it takes every press,
// double-click, right-click and wheel on the canvas around the element (the margins its insets leave), so nothing
// under it is selected, moved, marqueed, drawn on, panned or zoomed; the chrome above it (panels, toolbar, the
// bottom controls) stays reachable. `data-canvas-cover` also tells the canvas's capture-phase handler to stand down
// for a press inside it (useCanvasSurfaceGestures). The element sits in it at its insets, `marker` naming which.
export function CanvasCover({
  layout,
  marker,
  children,
}: {
  layout: CanvasLayout;
  marker: Record<string, string>;
  children: ReactNode;
}) {
  const { insets, band } = layout;
  return (
    <div
      data-canvas-cover=""
      className={`absolute inset-0 ${CANVAS_LAYER_Z}`}
      // An opaque backdrop: the canvas's own background (colour and pattern, from the canvas `main` it sits in), so
      // nothing on the canvas shows through around the element, yet it still reads as the canvas.
      style={{ background: 'inherit' }}
      onPointerDown={stop}
      onDoubleClick={stop}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onWheel={stop}
    >
      <div
        {...marker}
        {...(band ? { 'data-header-band': '' } : {})}
        className="absolute p-2 sm:p-3"
        // The header band (docs/specs/026-plan/plan-board.md "The header holds the top row"): the element's header
        // reads these, each with its own size as the fallback, so on the canvas nothing changes.
        style={{ ...insets, ...(band ? bandVars(band) : {}) } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

// The header band as the CSS properties a maximised element's header reads (PLAN_BAND_*).
export function bandVars(band: NonNullable<CanvasLayout['band']>): Record<string, string> {
  return {
    '--plan-band-h': `${band.height}px`,
    '--plan-band-left': `${band.left}px`,
    '--plan-band-mid': `${band.mid}px`,
  };
}

// The canvas `main` holding the slot, found from a marker rendered in the slot as it mounts: the marker's ref
// callback, and the element once found (null until then).
function useCanvasRoot(): [(node: HTMLElement | null) => void, HTMLElement | null] {
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const mark = useCallback((node: HTMLElement | null) => {
    if (node) setCanvas(node.closest<HTMLElement>('[data-canvas-a11y-root]') ?? document.body);
  }, []);
  return [mark, canvas];
}

// The element grows to the screen, or shrinks back to its place, over the dialogs' `long` token (MOTION_MS.long,
// the chrome ceiling in docs/specs/004-interface-design/motion.md) with the dialogs' own ease,
// cubic-bezier(0.16, 1, 0.3, 1). The ease stays literal in the transitions below: the motion-budget guard reads a
// variable there as an unbounded delay.
// The frame that grows or shrinks in the element's place, empty: a surface, border and shadow, no content.
const GHOST_CLASSES = [
  'rounded-xl',
  'border',
  'border-slate-200',
  'bg-white',
  'shadow-2xl',
  'dark:border-slate-700',
  'dark:bg-slate-900',
];
// How long the content takes to fade in once the frame has grown.
const REVEAL_MS = 120;

// The transform that lays a box drawn at `to` over `from` (top-left origin): where the element sits on the canvas.
export function flipTransform(from: DOMRect, to: DOMRect): string {
  if (to.width <= 0 || to.height <= 0) return 'none';
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
}

// The element's place on the canvas, from its canvas node.
function originOf(id: string): DOMRect | null {
  const node = document.querySelector(`[data-element-id="${CSS.escape(id)}"]`);
  const box = node?.getBoundingClientRect();
  return box && box.width > 0 && box.height > 0 ? box : null;
}

// Escape restores, unless a dialog over the element (the item panel, a confirm) or an open menu has it first
// (menus hear Escape on the document, after this capture listener), or the key is pressed inside something that
// uses Escape itself (`data-keeps-escape`: a Sheet's cell being edited, its Find bar, its copied range's marquee).
export function escapeRestores(
  e: Pick<KeyboardEvent, 'key' | 'defaultPrevented'> & { target?: EventTarget | null },
): boolean {
  const keeps = e.target instanceof Element && !!e.target.closest('[data-keeps-escape]');
  return (
    e.key === 'Escape' &&
    !e.defaultPrevented &&
    !keeps &&
    !document.querySelector(`[aria-modal="true"],[${MENU_SURFACE_ATTR}]`)
  );
}

// While `id` is maximised: Escape restores it (even with something selected), and the element going (unmounted: a tab switch, a deletion)
// or leaving Plan mode (`interactive` false) lets it go.
export function useMaximisedPlanLifetime(
  id: string,
  maximised: boolean,
  interactive: boolean,
): void {
  useEffect(() => {
    if (maximised && !interactive) releasePlanElement(id);
  }, [id, maximised, interactive]);
  useEffect(() => () => releasePlanElement(id), [id]);
  useEffect(() => {
    if (!maximised) return;
    // Capture phase, before the editor's own Escape (which deselects, and would leave this Escape prevented):
    // one Escape restores, and goes no further.
    const onKey = (e: KeyboardEvent) => {
      if (!escapeRestores(e)) return;
      e.preventDefault();
      e.stopPropagation();
      restorePlanElement();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [maximised]);
}

// What a slot's host is laid out as: filling whatever holds it (the canvas slot, or the overlay's box).
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
  children,
}: {
  id: string;
  maximised: boolean;
  // Filling its tab (docs/specs/026-plan/plan-board.md "Fill Tab"): drawn over the canvas area, under the editor's
  // chrome, at once (no grow), rather than over the whole screen. Takes `maximised`'s place.
  fill?: boolean;
  placeholder: CSSProperties;
  onMaximisedSize?: (size: { width: number; height: number } | null) => void;
  children: ReactNode;
}) {
  const [host] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.className = HOST_CLASS;
    return el;
  });
  const slotRef = useRef<HTMLDivElement>(null);
  // On the canvas: the host back in its slot (the overlay puts it in its box while maximised).
  const over = maximised || fill;
  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!over && host && slot && host.parentElement !== slot) slot.appendChild(host);
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
      onContextMenu={over ? stop : undefined}
      onWheel={over ? stop : undefined}
    >
      {createPortal(children, host)}
      {fill ? (
        <FilledTabLayer host={host} />
      ) : maximised ? (
        <MaximisedPlanLayer
          id={id}
          host={host}
          {...(onMaximisedSize ? { onSize: onMaximisedSize } : {})}
        />
      ) : null}
    </div>
  );
}

// Opening (a container transform): an empty frame (GHOST_CLASSES, no text, so never blurred by the scale) grows from
// the element's place to fill the screen. The content overlaps the grow's tail: the host moves into the box and
// fades in over the last REVEAL_MS (the frame is all but full size by then on this ease), so the whole maximise
// settles within MOTION_MS.long; the frame drops its ghost surface once the grow ends. Returns the cancel, which
// drops whatever is still pending and never reveals: restoring, or the layer going, takes the host from here.
export function openBox(box: HTMLElement, id: string, host: HTMLElement): () => void {
  const origin = originOf(id);
  box.style.opacity = '';
  const reveal = () => {
    if (host.parentElement !== box) box.appendChild(host);
  };
  const settle = () => box.classList.remove(...GHOST_CLASSES);
  if (!origin || prefersReducedMotion()) {
    box.style.transition = 'none';
    box.style.transform = 'none';
    reveal();
    settle();
    return () => {};
  }
  box.classList.add(...GHOST_CLASSES);
  // Measured untransformed, whatever a phase before left on it (a restore cut short, a re-run).
  box.style.transition = 'none';
  box.style.transform = 'none';
  box.style.transform = flipTransform(origin, box.getBoundingClientRect());
  void box.offsetWidth;
  box.style.transition = `transform ${MOTION_MS.long}ms cubic-bezier(0.16, 1, 0.3, 1)`;
  box.style.transform = 'none';
  let revealed = false;
  const show = () => {
    if (revealed) return;
    revealed = true;
    reveal();
    host.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: REVEAL_MS, easing: 'ease-out' });
  };
  const end = () => {
    show();
    settle();
  };
  const fade = window.setTimeout(show, MOTION_MS.long - REVEAL_MS);
  // The transition's end, or a timer should it never fire (a hidden tab).
  const done = window.setTimeout(end, MOTION_MS.long + 60);
  const onEnd = (e: TransitionEvent) => {
    if (e.target === box && e.propertyName === 'transform') end();
  };
  box.addEventListener('transitionend', onEnd);
  return () => {
    window.clearTimeout(fade);
    window.clearTimeout(done);
    box.removeEventListener('transitionend', onEnd);
  };
}

// Restoring (a container transform): the host goes straight back to its slot on the canvas, sharp in its own
// place, while an empty frame shrinks from the screen into that place and fades; then the restore finishes (at
// once without motion). Returns the cancel (maximising again while it shrinks back).
export function closeBox(box: HTMLElement, id: string, host: HTMLElement): () => void {
  const slot = document.querySelector(`[data-plan-slot="${CSS.escape(id)}"]`);
  if (slot && host.parentElement !== slot) slot.appendChild(host);
  const origin = originOf(id);
  if (!origin || prefersReducedMotion()) {
    finishRestore();
    return () => {};
  }
  box.classList.add(...GHOST_CLASSES);
  box.style.transition = 'none';
  box.style.transform = 'none';
  box.style.opacity = '1';
  const target = box.getBoundingClientRect();
  void box.offsetWidth;
  box.style.transition = `transform ${MOTION_MS.long}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${MOTION_MS.long}ms ease-in`;
  box.style.transform = flipTransform(origin, target);
  box.style.opacity = '0';
  const done = window.setTimeout(finishRestore, MOTION_MS.long + 60);
  const onEnd = (e: TransitionEvent) => {
    if (e.target === box && e.propertyName === 'transform') finishRestore();
  };
  box.addEventListener('transitionend', onEnd);
  return () => {
    window.clearTimeout(done);
    box.removeEventListener('transitionend', onEnd);
  };
}

// The overlay a maximised element's host moves into: the canvas area (CANVAS_LAYER_Z), grown from the element's place
// on open and shrunk back to it on restore. The editor's chrome (header, tab bar, footer, palette, panels) stays.
export function MaximisedPlanLayer({
  id,
  host,
  onSize,
}: {
  id: string;
  host: HTMLElement;
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

  // The box's laid-out size (untransformed, so the open animation never shows in it), for a view to fit.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !onSize) return;
    const report = () => onSize({ width: box.offsetWidth, height: box.offsetHeight });
    report();
    if (typeof ResizeObserver === 'undefined') return () => onSize(null);
    const ro = new ResizeObserver(report);
    ro.observe(box);
    return () => {
      ro.disconnect();
      onSize(null);
    };
  }, [onSize, canvas]);

  if (typeof document === 'undefined') return null;
  return (
    <>
      <span hidden ref={mark} />
      {canvas
        ? createPortal(
            <CanvasCover layout={layout} marker={{ 'data-maximised-board': '' }}>
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
export function FilledTabLayer({ host }: { host: HTMLElement }) {
  const [mark, canvas] = useCanvasRoot();
  // Clear of the chrome over the canvas: the top row (or holding it in the header band), side panels.
  const layout = useCanvasLayerInsets(canvas);
  const boxRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box && host.parentElement !== box) box.appendChild(host);
  }, [canvas, host]);
  return (
    <>
      <span hidden ref={mark} />
      {canvas
        ? createPortal(
            <CanvasCover layout={layout} marker={{ 'data-fill-tab-board': '' }}>
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
