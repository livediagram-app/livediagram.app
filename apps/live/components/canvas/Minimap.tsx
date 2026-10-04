'use client';

import { pageWritingBars } from '@/lib/article/article-export';
import { articleOpsToSvg } from '@/lib/article/article-draw';
import { useDeferredValue, useMemo, useRef } from 'react';
import {
  boundsOfPoints,
  endpointPosition,
  isBoxed,
  arrowLabelFontStack,
  arrowLabelPass,
  svgArrow,
  svgBoxed,
  svgShadowDefs,
  elementPageSurfaces,
  type Element,
  type LaidOutPage,
  type Point,
} from '@livediagram/document';
import { pageExportFrame } from '@/lib/export-page';
import { framesFirst, ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas';
import { resolveIconArtLoaded, resolveStickerArtLoaded } from '@/lib/icon-registry';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import type { MapSize } from '@/lib/user-preferences';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { selectionBoxColors } from '@/lib/selection-box';
import { useSettledElements } from '@/hooks/canvas/useSettledElements';

// Panel body heights per map size. Tailwind classes rather than inline styles
// so the dark-mode / responsive tooling still applies.
// Panel body heights per map size, in Tailwind's 4px scale: h-24 = 96px,
// h-36 = 144px, h-56 = 224px. MAP_RATIO above must match these.
const MAP_HEIGHT: Record<MapSize, string> = {
  short: 'h-24',
  medium: 'h-36',
  tall: 'h-56',
};

// The "Map" panel (docs/specs/008-canvas/minimap.md): a movable floating panel — like the Palette — with
// a zoomed-out, true-to-shape overview of the whole tab. Each boxed element is
// painted as its real silhouette (a circle reads as a circle) and each arrow as
// a connecting line; the area outside the current view is dimmed so the lit
// window reads as where you are. Tap or drag to re-centre the canvas there;
// scroll to zoom in on that spot. It drags, minimises and resets position like
// the other panels (MovablePanel), and a settings gear in its header holds the
// "Enable Map" toggle (off → showMinimap = false, re-enabled in Settings).
//
// Geometry: the canvas transform is `scale(z) translate(o)` about the <main>
// centre, so the viewport centre in world coords is (W/2 - oₓ, H/2 - o_y) and
// the visible world rect is (W/z × H/z) around it; re-centring on a world point
// P is offset = (W/2 - Pₓ, H/2 - P_y). The SVG's viewBox IS world space, so
// getScreenCTM() maps a click/scroll back to world coords (letterbox included).

type MinimapProps = {
  elements: Element[];
  // Illustrate mode's pages (docs/specs/007-editor/illustrate-pages.md "Getting around the
  // pages"): drawn under the content as their sheets, each outlined, and counted in the bounds.
  pages?: readonly LaidOutPage[];
  // The articles' writing, by identity: the picture redraws a page's lines of text as it changes.
  writing?: unknown;
  // The tab default face (docs/specs/004-interface-design/fonts.md): the miniature paints what the canvas
  // paints, so a canvas set in the marker face looks that way in the map too.
  tabFont?: string;
  viewportOffset: { x: number; y: number };
  viewportZoom: number;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  setViewportZoom: (zoom: number) => void;
  // The canvas <main>'s size, measured by the Canvas that owns it. Not observed here: the map renders
  // INSIDE <main>, and a child's layout effect runs before its parent's ref attaches, so a map mounted
  // in the same commit as the canvas (any document opened with enough elements) would read a null ref,
  // never measure, and lose its current-view window.
  mainSize: { width: number; height: number };
  // The tab's resolved paper colour (the backdrop the canvas paints). The map
  // paints the same paper behind its miniature, so a card reads against the
  // colour it sits on in the canvas rather than a fixed grey.
  paperColor: string;
  // The active tab theme's own stroke (null when it sets none), used to colour
  // the current-view window like the canvas marquee (selectionBoxColors).
  accentColor: string | null;
  // Panel position (null = default corner) + its move handler, shared with
  // the other floating panels via the docking layout.
  position: { x: number; y: number } | null;
  onMove: (x: number, y: number) => void;
  // Reset-to-default lives in the settings popover (not a header button),
  // so it sits beside the Enable Map toggle. `resettable` greys it out when
  // the map is already at its default corner.
  onResetPosition: () => void;
  // Corner-docking bundle (docs/specs/007-editor/panel-docking.md), forwarded to the inner MovablePanel.
  dock?: MovablePanelDockProps;
  // Map options (docs/specs/008-canvas/minimap.md), all persisted preferences.
  dimOutside: boolean;
  size: MapSize;
};

// Padding around the content (a fraction of its size plus a floor) so elements
// never touch the map's edge.
const PAD_FRACTION = 0.12;
const PAD_MIN = 48;
// What the catalogue resolvers find before the catalogue chunk lands.
const NO_ART = () => undefined;
// An element as the Map draws it: its label left out (docs/specs/008-canvas/minimap.md "What it shows").
function withoutLabel(el: Element): Element {
  if (!('label' in el) && !('richText' in el)) return el;
  const {
    label: _label,
    richText: _richText,
    ...rest
  } = el as Element & { label?: unknown; richText?: unknown };
  return rest as Element;
}
// The map's on-screen size in px (the w-64 panel — matching the Palette — and
// its h-36 svg). The viewBox is expanded to this aspect ratio so the wireframe
// fills the panel edge-to-edge rather than letterboxing into white bars under
// preserveAspectRatio="meet".
// The panel body's aspect ratio, per map size (docs/specs/008-canvas/minimap.md). It has to track
// MAP_HEIGHT below: the viewBox is grown on its short axis to THIS ratio so
// the map fills the panel edge to edge, and a stale number here letterboxes —
// picking Tall grew the panel but left the drawing its old shape, so all the
// new height went to blank bars above and below.
const MAP_RATIO: Record<MapSize, number> = {
  short: 256 / 96,
  medium: 256 / 144,
  tall: 256 / 224,
};

export function Minimap({
  elements: liveElements,
  pages,
  writing,
  tabFont,
  viewportOffset,
  viewportZoom,
  setViewportOffset,
  setViewportZoom,
  mainSize,
  paperColor,
  accentColor,
  position,
  onMove,
  onResetPosition,
  dock,
  dimOutside,
  size,
}: MinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Drawn as the elements settle, not per frame of a gesture (docs/specs/008-canvas/canvas-performance.md),
  // and deferred: the change that settles them (a drag's release) commits first, and the Map's picture,
  // rebuilt and re-parsed for the whole board, follows as its own render.
  const elements = useDeferredValue(useSettledElements(liveElements));
  const draggingRef = useRef(false);

  // Which paper the canvas is (light / dark), from the SAME context the canvas
  // elements read (docs/specs/008-canvas/minimap.md "Fidelity"). The renderer
  // resolves every unstyled colour against it, so a Behaviour card that is a
  // dark card on a dark canvas is a dark card here too, not the light skin.
  const surface = useCanvasSurface();
  const viewColors = selectionBoxColors(accentColor, surface);
  // Re-render once the async icon catalogues land so Technology marks pop in.
  const iconsLoaded = useIconCatalogs();
  // One pass builds the full-fidelity markup (the SAME headless renderer the
  // exports / live image use — real colours, silhouettes, tables, freehand,
  // icon glyphs, rotation, curved arrows) plus the content bounds; recomputed
  // only when elements, the tab font or the icon catalogues change —
  // panning/zooming re-renders just the viewport overlay below. It is shown as ONE image of that markup
  // (docs/specs/008-canvas/minimap.md "What it shows"), not injected as live elements: on a large
  // board a live copy doubled the page and slowed every gesture
  // (docs/specs/008-canvas/canvas-performance.md "The Map is one image"). It draws no labels: at the
  // Map's size they are a pixel or two tall, and laying them out was half the picture's cost.
  const { picture, bounds } = useMemo(() => {
    const drawn = elements.map(withoutLabel);
    const corners: Point[] = [];
    const parts: string[] = [];
    // The pages first, under everything: each sheet in its own paint with a crisp outline, so
    // even an empty page shows where it is.
    const paper = surface === 'dark' ? '#0f172a' : '#ffffff';
    const outline = surface === 'dark' ? '#94a3b8' : '#64748b';
    for (const page of pages ?? []) {
      const { x, y, width, height } = page.rect;
      parts.push(
        pageExportFrame(page, { paper, idPrefix: 'lvd-minimap-page' }).backgroundSvg +
          // An article page's writing, as soft lines of text.
          (page.flow ? articleOpsToSvg(pageWritingBars(page, outline)) : '') +
          `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${outline}" stroke-width="${Math.max(width, height) / 160}"/>`,
      );
      corners.push({ x, y }, { x: x + width, y: y + height });
    }
    // Each element inked for the page it is on, as the canvas inks it.
    const pageSurfaces = pages ? elementPageSurfaces(drawn, pages) : null;
    // The resolvers find nothing until the catalogue chunk lands, which
    // re-runs the build with the glyphs.
    const resolveIconArt = iconsLoaded ? resolveIconArtLoaded : NO_ART;
    const resolveStickerArt = iconsLoaded ? resolveStickerArtLoaded : NO_ART;
    const labels = arrowLabelPass(drawn, {
      fontFamilyOf: (a) => arrowLabelFontStack(a, tabFont),
    });
    // Boxed first (frames behind their contents), then arrows on top —
    // matching the canvas z-order.
    for (const el of framesFirst(drawn)) {
      if (el.type === 'arrow') continue;
      if (!isBoxed(el)) continue;
      parts.push(
        svgBoxed(el, {
          resolveIconArt,
          resolveStickerArt,
          tabFont,
          surface: pageSurfaces?.get(el.id) ?? surface,
        }),
      );
      corners.push({ x: el.x, y: el.y }, { x: el.x + el.width, y: el.y + el.height });
    }
    for (const el of drawn) {
      if (el.type !== 'arrow') continue;
      parts.push(
        svgArrow(
          el,
          drawn,
          pageSurfaces?.get(el.id) ?? surface,
          tabFont,
          labels,
          'lvd-minimap-ko-',
        ),
      );
      corners.push(endpointPosition(el.from, drawn), endpointPosition(el.to, drawn));
    }
    const content = boundsOfPoints(corners);
    if (!content) return { picture: null, bounds: null };
    // The picture covers the padded content box, so strokes and shadows past the corners still show.
    const px = content.width * PAD_FRACTION + PAD_MIN;
    const py = content.height * PAD_FRACTION + PAD_MIN;
    const box = {
      x: content.x - px,
      y: content.y - py,
      width: content.width + 2 * px,
      height: content.height + 2 * py,
    };
    const doc =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" width="${box.width}" height="${box.height}">` +
      `${svgShadowDefs(elements)}${parts.join('')}</svg>`;
    return {
      // Our own renderer's output (user text is xmlEscaped inside it), shown as an image.
      picture: { ...box, href: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}` },
      bounds: content,
    };
    // `writing` changes with the documents' text, which the bars read off the editors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, pages, tabFont, iconsLoaded, surface, writing]);

  const recentreToClient = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm || !mainSize.width) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const world = pt.matrixTransform(ctm.inverse());
    const nx = mainSize.width / 2 - world.x;
    const ny = mainSize.height / 2 - world.y;
    // Only write when it actually changes: setting an equal-valued new object
    // every render would re-render forever (max update depth).
    if (nx !== viewportOffset.x || ny !== viewportOffset.y) {
      setViewportOffset({ x: nx, y: ny });
    }
    return world;
  };

  if (!bounds) return null; // Nothing to map.

  const padX = bounds.width * PAD_FRACTION + PAD_MIN;
  const padY = bounds.height * PAD_FRACTION + PAD_MIN;
  // Padded content box, then grown on the short axis to the panel's aspect
  // ratio so the map fills it with no white letterbox bars.
  let x0 = bounds.x - padX;
  let y0 = bounds.y - padY;
  let x1 = bounds.x + bounds.width + padX;
  let y1 = bounds.y + bounds.height + padY;
  const ratio = MAP_RATIO[size];
  if ((x1 - x0) / (y1 - y0) < ratio) {
    const grow = ((y1 - y0) * ratio - (x1 - x0)) / 2;
    x0 -= grow;
    x1 += grow;
  } else {
    const grow = ((x1 - x0) / ratio - (y1 - y0)) / 2;
    y0 -= grow;
    y1 += grow;
  }
  const vb = `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;

  const w = mainSize.width;
  const h = mainSize.height;
  const z = viewportZoom || 1;
  const viewCx = w / 2 - viewportOffset.x;
  const viewCy = h / 2 - viewportOffset.y;
  // Visible-world rect, clamped to the padded content box so the "current view"
  // highlight + the dimmed surround never spill past the map edges.
  const vx = Math.max(x0, viewCx - w / z / 2);
  const vy = Math.max(y0, viewCy - h / z / 2);
  const vx1 = Math.min(x1, viewCx + w / z / 2);
  const vy1 = Math.min(y1, viewCy + h / z / 2);
  const hasView = vx1 > vx && vy1 > vy;

  // Scroll on the map zooms the canvas in/out centred on that spot.
  const onWheel = (e: React.WheelEvent) => {
    const world = recentreToClient(e.clientX, e.clientY);
    if (!world) return;
    const factor = Math.exp(-e.deltaY / 200);
    setViewportZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, viewportZoom * factor)));
  };

  return (
    <MovablePanel
      helpArticle="minimap"
      title="Map"
      position={position}
      defaultCorner="bottom-left"
      width="w-64"
      onMoveTo={onMove}
      {...dock}
      collapsible
      flushTop
      growBody
      onReset={onResetPosition}
    >
      {/* Clip the map to the panel's rounded bottom so its corners don't
          square off past the border. */}
      <div className="overflow-hidden rounded-b-lg">
        <svg
          ref={svgRef}
          viewBox={vb}
          preserveAspectRatio="xMidYMid meet"
          className={`block w-full cursor-pointer touch-none text-slate-400 ${MAP_HEIGHT[size]}`}
          style={{ backgroundColor: paperColor }}
          role="img"
          aria-label="Canvas map — tap or drag to navigate, scroll to zoom"
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            recentreToClient(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) recentreToClient(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            draggingRef.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onWheel={onWheel}
        >
          {/* The tab's real rendering, as one image (see the picture build above). */}
          {picture ? (
            <image
              href={picture.href}
              x={picture.x}
              y={picture.y}
              width={picture.width}
              height={picture.height}
              preserveAspectRatio="none"
            />
          ) : null}
          {hasView ? (
            <>
              {/* Dim everything outside the current view (even-odd: outer box
                minus the view hole) so the lit window reads at a glance as
                "where you are on the canvas". Optional: on a dense canvas some
                people would rather read the whole map. */}
              {dimOutside ? (
                <path
                  d={`M${x0} ${y0}H${x1}V${y1}H${x0}Z M${vx} ${vy}H${vx1}V${vy1}H${vx}Z`}
                  fillRule="evenodd"
                  className={surface === 'dark' ? 'fill-black/45' : 'fill-slate-500/25'}
                />
              ) : null}
              <rect
                x={vx}
                y={vy}
                width={vx1 - vx}
                height={vy1 - vy}
                rx={3}
                fill={viewColors.fill}
                stroke={viewColors.stroke}
                strokeWidth={1.75}
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : null}
        </svg>
      </div>
    </MovablePanel>
  );
}
