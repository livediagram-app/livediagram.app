'use client';

// A maximised Plan element (docs/specs/026-plan/plan-board.md "Maximised board", plan-views.md "Maximised view"):
// a board's or a visualisation's body drawn over the canvas area, under the editor's chrome, for this person only. The body is always
// rendered through a portal into one host element of its own (MaximisableSlot), and only that host moves: into its
// slot on the canvas, or into the overlay's box while maximised. So maximising and restoring never remount the body
// (a Gantt keeps its scale, window and collapsed lanes; a drag in flight survives), and PlanContext and the canvas
// surface still reach it. While maximised, its presses stop at the slot so the canvas never selects or moves the
// element underneath.
import { useCanvasMenu } from '@/components/canvas/canvas-menu-context';
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
import { isAnimatedPattern } from '@livediagram/document';
import { TabPatternLayer } from '@/components/canvas/TabPatternLayer';
import { useCanvasPattern } from '@/components/canvas/canvas-pattern-context';
import { prefersReducedMotion } from '@/lib/motion-preference';
import { useCanvasLayerInsets } from '@/hooks/ui/useCanvasLayerInsets';
import type { CanvasLayout, PhoneRow } from '@/lib/canvas-layer-insets';
import { announceHeaderBand } from './menu-name-slot';
import { BAND_CARD_PX } from './band-controls';
import { useUiScale } from '@/components/providers/ui-scale';
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
  tint,
  blend,
  children,
}: {
  layout: CanvasLayout;
  marker: Record<string, string>;
  // The element's hue (planBandTint), worn by the menu box and palette while its header holds the top row.
  tint?: string | undefined;
  // The element's own surface and border (planBandBlend): with it, the chrome in the band takes them instead, flat
  // (no shadow), so the top row reads as part of the element.
  blend?: BandBlend | undefined;
  children: ReactNode;
}) {
  const { insets, band, row } = layout;
  // An animated canvas style is a layer of the canvas's own, under this cover: drawn again here, as the inherited
  // background carries only the colour and a static pattern (the canvas's copy stops meanwhile: canvas-motion.css).
  const pattern = useCanvasPattern();
  // The menu box is drawn at the toolbar's UI scale; the band's cards take its height (band-controls BAND_CARD_PX).
  const toolbarScale = useUiScale('toolbar');
  // The element's name moves to the menu box while there is a band, and back when it goes (menu-name-slot).
  const banded = !!band;
  useLayoutEffect(() => {
    announceHeaderBand();
    return announceHeaderBand;
  }, [banded]);
  // The palette moves to the header's right end, before its controls (plan-board.md "The header holds the top row"):
  // set on the canvas the strip sits in, so the strip itself never re-renders for it.
  const coverRef = useRef<HTMLDivElement>(null);
  const stripEnd = band?.stripEnd ?? null;
  useLayoutEffect(() => {
    const main = coverRef.current?.parentElement;
    if (!main || stripEnd === null) return;
    setStripEnd(main, stripEnd);
    return () => clearStripEnd(main);
  }, [stripEnd]);
  // The chrome in the band wears the element's hue (toolbar-surface BAND_TINT): set on the canvas they sit in.
  const bandTint = band && tint && !blend ? tint : null;
  useLayoutEffect(() => {
    const main = coverRef.current?.parentElement;
    if (!main || !bandTint) return;
    setBandTint(main, bandTint);
    return () => clearBandTint(main);
  }, [bandTint]);
  // On a phone's shared row too (canvas-layer-insets phoneRow), so the menu box reads as part of the element.
  const blendSurface = (band || row) && blend ? blend.surface : null;
  const blendLine = blend?.line ?? null;
  useLayoutEffect(() => {
    const main = coverRef.current?.parentElement;
    if (!main || !blendSurface || !blendLine) return;
    main.setAttribute('data-band-blend', '');
    main.style.setProperty('--band-surface', blendSurface);
    main.style.setProperty('--band-line', blendLine);
    return () => {
      main.removeAttribute('data-band-blend');
      main.style.removeProperty('--band-surface');
      main.style.removeProperty('--band-line');
    };
  }, [blendSurface, blendLine]);
  return (
    <div
      ref={coverRef}
      data-canvas-cover=""
      // The default cursor: it takes every press, so the canvas's pan hand (inherited from `main`) never shows over it.
      className={`absolute inset-0 cursor-default ${CANVAS_LAYER_Z}`}
      // An opaque backdrop: the canvas's own background (colour and static pattern, from the canvas `main` it sits in),
      // so nothing on the canvas shows through around the element, yet it still reads as the canvas.
      style={{ background: 'inherit' }}
      onPointerDown={stop}
      onDoubleClick={stop}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onWheel={stop}
    >
      {pattern && isAnimatedPattern(pattern.pattern) ? <TabPatternLayer {...pattern} /> : null}
      <div
        {...marker}
        {...(band ? { 'data-header-band': '' } : {})}
        className="absolute p-2 sm:p-3"
        // The header band (docs/specs/026-plan/plan-board.md "The header holds the top row"): the element's header
        // reads these, each with its own size as the fallback, so on the canvas nothing changes.
        // On a phone, the row it shares with the menu (canvas-layer-insets phoneRow): the same height and start, no more.
        style={{
          ...insets,
          ...(band ? bandVars(band, toolbarScale) : row ? rowVars(row) : {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

// The strip's place in a header band, as the properties its root reads (ToolbarPalette): pressed to the right,
// `stripEnd` screen px from the canvas's right edge, written in the strip's own px (its UI scale zooms it).
export function setStripEnd(main: HTMLElement, stripEnd: number): void {
  const strip = main.querySelector<HTMLElement>('[data-toolbar-palette]');
  const zoom = strip ? parseFloat(getComputedStyle(strip).zoom) || 1 : 1;
  main.style.setProperty('--plan-strip-align', 'flex-end');
  main.style.setProperty('--plan-strip-end', `${Math.round(stripEnd / zoom)}px`);
}

// An element's own surface and border, for the chrome in its band to take (toolbar-surface BAND_BLEND).
export type BandBlend = { surface: string; line: string };

// The element's hue on the chrome in its band (toolbar-surface BAND_TINT), set on the canvas they sit in.
export function setBandTint(main: HTMLElement, tint: string): void {
  main.setAttribute('data-band-tint', '');
  main.style.setProperty('--band-tint', tint);
}

export function clearBandTint(main: HTMLElement): void {
  main.removeAttribute('data-band-tint');
  main.style.removeProperty('--band-tint');
}

export function clearStripEnd(main: HTMLElement): void {
  main.style.removeProperty('--plan-strip-align');
  main.style.removeProperty('--plan-strip-end');
}

// The header band as the CSS properties a maximised element's header reads (PLAN_BAND_*).
export function bandVars(
  band: NonNullable<CanvasLayout['band']>,
  toolbarScale = 1,
): Record<string, string> {
  return {
    '--plan-band-h': `${band.height}px`,
    // The menu box's height on screen, which each card in the band matches: its controls and inset at the toolbar's
    // scale, its hairline border a screen px whatever the scale.
    '--plan-band-card-h': `${Math.round(((BAND_CARD_PX - 2) * toolbarScale + 2) * 10) / 10}px`,
    '--plan-band-left': `${band.left}px`,
    '--plan-band-mid': `${band.mid}px`,
  };
}

// A phone's shared top row as the properties the element's header reads: its height and where its content starts.
export function rowVars(row: PhoneRow): Record<string, string> {
  return { '--plan-band-h': `${row.height}px`, '--plan-band-left': `${row.left}px` };
}

// The canvas `main` holding the slot, found from a marker rendered in the slot as it mounts: the marker's ref
// callback, and the element once found (null until then).
export function useCanvasRoot(): [(node: HTMLElement | null) => void, HTMLElement | null] {
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
type BoxSize = { width: number; height: number };

// The box's laid-out size (untransformed, so the open animation never shows in it), for a view to fit: reported now
// and on every resize, and null when the box goes. Both maximised layers report through it.
function useReportedBoxSize(
  boxRef: { current: HTMLElement | null },
  onSize: ((size: BoxSize | null) => void) | undefined,
  canvas: unknown,
): void {
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
  }, [boxRef, onSize, canvas]);
}

export function flipTransform(from: DOMRect, to: DOMRect): string {
  if (to.width <= 0 || to.height <= 0) return 'none';
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`;
}

// Where the element is drawn on screen, measured at the moment it is asked: its slot (MaximisableSlot's own box, which
// stays in place while the body is away), else its canvas node. The slot is where it really is: in a Dashboard slot the
// element is drawn in the slot, while its canvas node sits out of sight under the page (plan-tabs.md "Slot content"),
// so growing from or shrinking to the canvas node would fly to a place the element is not.
export function originOf(id: string): DOMRect | null {
  const key = CSS.escape(id);
  for (const selector of [`[data-plan-slot="${key}"]`, `[data-element-id="${key}"]`]) {
    const box = document.querySelector(selector)?.getBoundingClientRect();
    if (box && box.width > 0 && box.height > 0) return box;
  }
  return null;
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
      {createPortal(children, host)}
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

// Opening (a container transform): an empty frame (GHOST_CLASSES, no text, so never blurred by the scale) grows from
// the element's place to fill the screen. The content overlaps the grow's tail: the host moves into the box and
// fades in over the last REVEAL_MS (the frame is all but full size by then on this ease), so the whole maximise
// settles within MOTION_MS.long; the frame drops its ghost surface once the grow ends. Returns the cancel, which
// drops whatever is still pending and never reveals: restoring, or the layer going, takes the host from here.
export function openBox(box: HTMLElement, id: string, host: HTMLElement): () => void {
  const origin = originOf(id);
  box.style.opacity = '';
  const reveal = () => {
    if (host.parentElement !== box) {
      box.appendChild(host);
      // Moved under the band: its name looks again (menu-name-slot).
      announceHeaderBand();
    }
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
  if (slot && host.parentElement !== slot) {
    slot.appendChild(host);
    announceHeaderBand();
  }
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
export function FilledTabLayer({
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
  // Clear of the chrome over the canvas: the top row (or holding it in the header band), side panels.
  const layout = useCanvasLayerInsets(canvas);
  const boxRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box && host.parentElement !== box) {
      box.appendChild(host);
      announceHeaderBand();
    }
  }, [canvas, host]);
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
