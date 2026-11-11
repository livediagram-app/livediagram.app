// The cover a maximised Board or Sheet lays over the canvas (./MaximisedPlanLayer): it hides the canvas's own
// drawing and carries the band's tint and the phone rows' strip, set straight on the canvas's DOM. Re-exported from
// ./MaximisedPlanLayer.
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { isAnimatedPattern } from '@liveplanner/project';
import { TabPatternLayer } from '@/components/canvas/TabPatternLayer';
import { useCanvasPattern } from '@/components/canvas/canvas-pattern-context';
import type { CanvasLayout, PhoneRow } from '@/lib/canvas-layer-insets';
import { announceHeaderBand } from './menu-name-slot';
import { BAND_CARD_PX } from './band-controls';
import { useUiScale } from '@liveworkspace/workbench/components/providers/ui-scale';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';

export const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// A maximised or tab-filling element is drawn over the canvas area (the canvas's own `main`), over its content, inset
// clear of the chrome laid over the canvas (the Toolbar layout's top row, side panels, the zoom controls:
// useCanvasLayerInsets), with the header, tab bar and footer outside `main`: docs/specs/026-plan/plan-board.md
// "Maximised board", "Fill Tab". Under the panels too, should one be dragged over it.
const CANVAS_LAYER_Z = 'z-[calc(var(--z-panel)-1)]';

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
  enter = false,
  children,
}: {
  layout: CanvasLayout;
  marker: Record<string, string>;
  // A tab's own page (a Board, Sheet, Dashboard or Form tab): it fades in as it mounts, on a tab switch
  // (docs/specs/026-plan/plan-tabs.md "Switching to a tab fades its content in"). Not a maximised element, which grows.
  enter?: boolean;
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
    setAttr(main, 'data-band-blend', '');
    setProp(main, '--band-surface', blendSurface);
    setProp(main, '--band-line', blendLine);
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
        // Opacity only: nothing in it is measured off its place while it fades. CSS on mount, so never on a re-render.
        className={`absolute p-2 sm:p-3 ${enter ? 'animate-tab-in' : ''}`}
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
function setStripEnd(main: HTMLElement, stripEnd: number): void {
  const strip = main.querySelector<HTMLElement>('[data-toolbar-palette]');
  const zoom = strip ? parseFloat(getComputedStyle(strip).zoom) || 1 : 1;
  setAttr(main, 'data-strip-in-band', '');
  setProp(main, '--plan-strip-align', 'flex-end');
  setProp(main, '--plan-strip-end', `${Math.round(stripEnd / zoom)}px`);
}

// Writes that skip what is already there: an identical attribute or property write still reaches a MutationObserver
// (the layout hook's, a test's) as a change, and the canvas restyles for it.
function setAttr(el: HTMLElement, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function setProp(el: HTMLElement, name: string, value: string): void {
  if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
}

// An element's own surface and border, for the chrome in its band to take (toolbar-surface BAND_BLEND).
export type BandBlend = { surface: string; line: string };

// The element's hue on the chrome in its band (toolbar-surface BAND_TINT), set on the canvas they sit in.
function setBandTint(main: HTMLElement, tint: string): void {
  setAttr(main, 'data-band-tint', '');
  setProp(main, '--band-tint', tint);
}

function clearBandTint(main: HTMLElement): void {
  main.removeAttribute('data-band-tint');
  main.style.removeProperty('--band-tint');
}

function clearStripEnd(main: HTMLElement): void {
  main.removeAttribute('data-strip-in-band');
  main.style.removeProperty('--plan-strip-align');
  main.style.removeProperty('--plan-strip-end');
}

// The header band as the CSS properties a maximised element's header reads (PLAN_BAND_*).
function bandVars(
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
function rowVars(row: PhoneRow): Record<string, string> {
  return { '--plan-band-h': `${row.height}px`, '--plan-band-left': `${row.left}px` };
}

// The canvas `main` holding the slot, found from a marker rendered in the slot as it mounts: the marker's ref
// callback, and the element once found (null until then).
export function useCanvasRoot(): [(node: HTMLElement | null) => void, HTMLElement | null] {
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const mark = useCallback((node: HTMLElement | null) => {
    if (node) setCanvas(node.closest<HTMLElement>(CANVAS_ROOT_SELECTOR) ?? document.body);
  }, []);
  return [mark, canvas];
}

// The element grows to the screen, or shrinks back to its place, over the dialogs' `long` token (MOTION_MS.long,
// the chrome ceiling in docs/specs/004-interface-design/motion.md) with the dialogs' own ease,
// cubic-bezier(0.16, 1, 0.3, 1). The ease stays literal in the transitions below: the motion-budget guard reads a
// variable there as an unbounded delay.
// The frame that grows or shrinks in the element's place, empty: a surface, border and shadow, no content.
