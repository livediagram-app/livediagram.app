'use client';

import { trustedHtml } from '@livedesign/ui';

// A tab window's drawing (docs/specs/009-elements/tab-window.md "The element"): the tab drawn as the editor shows it
// (useTabSvg: the export renderer, in this person's appearance, with its photos and the document's cards), zoomed to
// fit and centred on the tab's own canvas: its paper and its pattern (dots, grid, lines) at the drawing's fit, lined
// up with it, as the editor paints them for that tab in its mode (useTabBackdropPaint). Inline rather than an image so the page's typefaces apply, its ids prefixed so
// its gradients and markers never meet the canvas's. Loaded only once a window is on screen (the renderer is heavy).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { prefixSvgIds, type Tab } from '@livedesign/document';
import { useTabSvg } from '@/components/split/useTabSvg';
import { usePlanImageExport } from '@/components/dialogs/usePlanImageExport';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useTabBackdropPaint } from '@/components/split/useTabBackdropPaint';
import { windowMotion } from './tab-window-motion';

export function TabWindowDrawing({ tab, elementId }: { tab: Tab; elementId: string }) {
  // A Plan tab (a Board, Sheet or Dashboard tab) is drawn as laid out, as its image export draws it: its cards, its
  // Sheets' cells and its plan views' pictures ("The drawing"). Any other tab is itself, with any plan view on it.
  const { tabs } = useEditorContext();
  const plan = usePlanImageExport(tab, tabs);
  // The drawing moves as the tab does on the canvas ("The drawing"): its elements' animations play in the window.
  const svg = useTabSvg(plan.imageTab, windowMotion, plan.opts);
  const paint = useTabBackdropPaint(tab);
  const svgRef = useRef<SVGSVGElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useFrameSize(frameRef, svg != null);
  // Ids prefixed so the drawing's gradients and markers never meet the canvas's. The outer <svg> is JSX, so no
  // markup is built here: only the renderer's own output goes in as HTML.
  const inner = useMemo(
    () => (svg ? prefixSvgIds(svg.markup, `tw-${elementId}-`.replace(/[^a-zA-Z0-9-]/g, '')) : null),
    [svg, elementId],
  );
  // The frame mounts with the first drawing, so the watch starts then.
  useHoldOffscreen(frameRef, inner != null);
  // Each redraw (an edit on the shown tab) replaces the markup, which would restart every loop mid-beat. Pin the
  // loops to the document's clock, as arrow flows are on the canvas, so they run on through a redraw and stay in
  // step with each other. A play-once is left to start as it is drawn.
  useEffect(() => {
    const node = svgRef.current;
    if (!node || inner == null) return;
    const raf = window.requestAnimationFrame(() => pinLoops(node));
    return () => window.cancelAnimationFrame(raf);
  }, [inner]);
  if (inner == null || !svg) return null;
  return (
    <div
      ref={frameRef}
      data-tab-window-drawing=""
      className="pointer-events-none absolute inset-0"
      // Strict containment: a moving element redraws inside the window and never asks the canvas to lay out again.
      style={{
        ...(size ? backdropAtFit(paint, size, svg) : { background: svg.background }),
        contain: 'strict',
      }}
    >
      <svg
        ref={svgRef}
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        viewBox={`0 0 ${svg.width} ${svg.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        // Its own paper rect is hidden: the frame paints the paper and pattern edge to edge, as the split pane does.
        className="[&>svg>rect:first-of-type]:hidden"
        style={{ display: 'block' }}
        // Our own renderer's output (every label is xmlEscaped inside it).
        dangerouslySetInnerHTML={{ __html: trustedHtml(inner) }}
      />
    </div>
  );
}

/** Where the drawing sits in a frame of `size` px, fitted and centred ("meet"): its zoom, and where canvas point (0, 0)
 *  falls, so the pattern behind it lines up with what is drawn. */
export function drawingFit(
  size: { w: number; h: number },
  svg: { width: number; height: number; origin: { x: number; y: number } },
): { k: number; origin: { x: number; y: number } } {
  const k = Math.min(size.w / svg.width, size.h / svg.height);
  const left = (size.w - svg.width * k) / 2;
  const top = (size.h - svg.height * k) / 2;
  return { k, origin: { x: left - svg.origin.x * k, y: top - svg.origin.y * k } };
}

function backdropAtFit(
  paint: ReturnType<typeof useTabBackdropPaint>,
  size: { w: number; h: number },
  svg: { width: number; height: number; origin: { x: number; y: number } },
) {
  const { k, origin } = drawingFit(size, svg);
  return paint(origin, k);
}

// The frame's size in px, as the window is resized (or zoomed with the canvas, which scales it by transform and so
// leaves this alone: the pattern scales with the drawing either way).
function useFrameSize(ref: RefObject<HTMLDivElement | null>, drawn: boolean) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : w && h ? { w, h } : null));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, drawn]);
  return size;
}

// A window scrolled or zoomed off screen holds its drawing still (its loops pause where they are), so a deck of
// slides each showing a moving tab spends nothing on the ones out of sight. The flag rides the frame as an
// attribute, so a pause never re-renders the drawing.
function useHoldOffscreen(ref: RefObject<HTMLDivElement | null>, drawn: boolean) {
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const shown = entries.some((e) => e.isIntersecting);
      node.toggleAttribute('data-held', !shown);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, drawn]);
}

function pinLoops(node: SVGSVGElement) {
  for (const a of node.getAnimations?.({ subtree: true }) ?? []) {
    if (a.effect?.getTiming().iterations !== Infinity) continue;
    try {
      a.startTime = 0;
    } catch {
      // An engine that refuses still plays the loop, only not in step.
    }
  }
}
