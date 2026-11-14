'use client';

import { CANVAS_PAPER } from '@/lib/page-paint';
import { writingBarsByPage } from '@/lib/article/page-writing-bars';
import { useArticleLaidOutSeq } from '@/lib/article/article-editor-store';
import { articleOpsToSvg } from '@/lib/article/article-draw';
import { useDeferredValue, useMemo, useState } from 'react';
import { createArrowGeometryCache } from '@liveworkspace/workbench/lib/arrow-geometry-cache';
import { MinimapMap, minimapPicture } from '@liveworkspace/workbench/components/canvas/MinimapMap';
import {
  boundsOfPoints,
  endpointPosition,
  isBoxed,
  arrowLabelFontStack,
  arrowLabelPass,
  svgArrow,
  sketchBackdropIds,
  svgBoxed,
  chartPageGrounds,
  svgShadowDefs,
  elementPageSurfaces,
  routeBehindQueryRect,
  spreadArrowEnds,
  type ArrowElement,
  type Element,
  type LaidOutPage,
  type Point,
  type Rect,
} from '@livedocuments/document';
import { pageExportFrame } from '@/lib/export-page';
import { containersFirst, ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { useIconCatalogs } from '@liveworkspace/workbench/hooks/ui/useIconCatalogs';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import type { MapSize } from '@/lib/user-preferences';
import {
  useCanvasChartPalette,
  useCanvasSurface,
} from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
import { useTabFinish } from '@liveworkspace/workbench/components/canvas/CanvasFinishContext';
import { selectionBoxColors } from '@/lib/selection-box';
import { useSettledElements } from '@/hooks/canvas/useSettledElements';

// The "Map" panel (docs/specs/008-canvas/minimap.md): a movable floating panel — like the Palette — with
// a zoomed-out, true-to-shape overview of the whole tab. Each boxed element is
// painted as its real silhouette (a circle reads as a circle) and each arrow as
// a connecting line; the area outside the current view is dimmed so the lit
// window reads as where you are. Tap or drag to re-centre the canvas there;
// scroll to zoom in on that spot. It drags, minimises and resets position like
// the other panels (MovablePanel), and a settings gear in its header holds the
// "Enable Map" toggle (off → showMinimap = false, re-enabled in Settings).
// The map's body (the window, the dim, the presses) is the shared MinimapMap.

type MinimapProps = {
  elements: Element[];
  // Pages mode's pages (docs/specs/007-editor/pages-mode.md "Getting around the
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

// What the catalogue resolvers find before the catalogue chunk lands.
const NO_ART = () => undefined;
const NO_ELEMENTS: Element[] = [];
// The picture's parts carried over from the last build (docs/specs/008-canvas/canvas-performance.md "The Map draws
// what changed"): each element as drawn (its label left out) and each box's markup, by the element; each arrow's
// markup, for the arrows no change reaches (the layer's arrow geometry cache, the same reads). A commit that moves
// one box draws that box and the arrows it reached, not the board. The pages are drawn afresh each build: there are a
// few of them, and their writing changes with the articles' text.
type BoxedOptions = NonNullable<Parameters<typeof svgBoxed>[1]>;
type Surface = NonNullable<BoxedOptions['surface']>;
type ArrowPart = { svg: string; reach: Rect; surface: Surface };
export function minimapParts() {
  return {
    plain: new WeakMap<Element, Element>(),
    boxed: new WeakMap<Element, { key: string; svg: string }>(),
    arrows: createArrowGeometryCache<Element, ArrowPart>({
      isArrow: (el) => el.type === 'arrow',
      ends: (arrow) => [(arrow as ArrowElement).from, (arrow as ArrowElement).to],
      reach: (part) => part.reach,
      // No mind map here, so no arrow reads more than its neighbours.
      structural: () => false,
    }),
  };
}

// The Map's picture for `elements` (see Minimap), drawing afresh only the parts `parts` cannot carry over.
export function minimapBuild(
  parts: ReturnType<typeof minimapParts>,
  elements: Element[],
  {
    pages,
    writing,
    tabFont,
    tabFinish,
    iconsLoaded,
    surface,
    chartPalette,
  }: {
    pages: readonly LaidOutPage[] | undefined;
    writing: unknown;
    tabFont: string | undefined;
    tabFinish: BoxedOptions['tabFinish'];
    iconsLoaded: boolean;
    surface: Surface;
    chartPalette: BoxedOptions['chartPalette'];
  },
) {
  const drawn = elements.map((el) => {
    let plain = parts.plain.get(el);
    if (!plain) parts.plain.set(el, (plain = withoutLabel(el)));
    return plain;
  });
  // What every part reads beyond its element: a part drawn under another is drawn again.
  const key = `${tabFont}|${tabFinish}|${iconsLoaded}|${surface}|${JSON.stringify(chartPalette ?? null)}`;
  const corners: Point[] = [];
  const markup: string[] = [];
  // The pages first, under everything: each sheet in its own paint with a crisp outline, so
  // even an empty page shows where it is.
  const paper = CANVAS_PAPER[surface === 'dark' ? 'dark' : 'light'];
  const outline = surface === 'dark' ? '#94a3b8' : '#64748b';
  // Every article page's writing, as soft lines of text, read in one pass for the whole row.
  const barsOf = writingBarsByPage(
    pages ?? [],
    outline,
    writing ? { articles: writing } : undefined,
  );
  for (const page of pages ?? []) {
    const { x, y, width, height } = page.rect;
    markup.push(
      pageExportFrame(page, { paper, idPrefix: 'lvd-minimap-page' }).backgroundSvg +
        (page.flow ? articleOpsToSvg(barsOf.get(page.id) ?? []) : '') +
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${outline}" stroke-width="${Math.max(width, height) / 160}"/>`,
    );
    corners.push({ x, y }, { x: x + width, y: y + height });
  }
  // Each element inked for the page it is on, as the canvas inks it.
  const pageSurfaces = pages ? elementPageSurfaces(drawn, pages) : null;
  // And each chart on a filled page adapted to what it sits on.
  const chartGrounds = pages ? chartPageGrounds(drawn, pages) : undefined;
  // The resolvers find nothing until the catalogue chunk lands, which
  // re-runs the build with the glyphs.
  const resolveIconArt = iconsLoaded ? resolveIconArtLoaded : NO_ART;
  const resolveStickerArt = iconsLoaded ? resolveStickerArtLoaded : NO_ART;
  // Laid out once a changed arrow draws (the knockouts it reads), not on every build.
  let labels: ReturnType<typeof arrowLabelPass> | null = null;
  const labelsOf = () =>
    (labels ??= arrowLabelPass(drawn, {
      fontFamilyOf: (a) => arrowLabelFontStack(a, tabFont, tabFinish),
    }));
  // Boxed first (containers behind their contents), then arrows on top,
  // matching the canvas z-order.
  // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
  const backdrops = sketchBackdropIds(drawn, tabFinish);
  for (const el of containersFirst(drawn)) {
    if (el.type === 'arrow') continue;
    if (!isBoxed(el)) continue;
    // A box reads, beyond the key, whether it is a backdrop, the page it is on and, for a chart, what it sits on.
    const boxSurface = pageSurfaces?.get(el.id) ?? surface;
    const ground = chartGrounds?.get(el.id);
    const boxKey = `${key}|${backdrops.has(el.id)}|${boxSurface}|${ground?.join(',') ?? ''}`;
    let box = parts.boxed.get(el);
    if (box?.key !== boxKey) {
      box = {
        key: boxKey,
        svg: svgBoxed(el, {
          resolveIconArt,
          resolveStickerArt,
          tabFont,
          tabFinish,
          sketchBackdrop: backdrops.has(el.id),
          surface: boxSurface,
          chartPalette,
          chartGrounds,
        }),
      };
      parts.boxed.set(el, box);
    }
    markup.push(box.svg);
    corners.push({ x: el.x, y: el.y }, { x: el.x + el.width, y: el.y + el.height });
  }
  // An arrow is inked for the page it is on too, which a change to the pages can alter where it reaches no arrow:
  // one carried over under another surface is drawn again.
  const drawArrow = (arrow: ArrowElement, arrowSurface: Surface): ArrowPart => {
    const { from, to } = spreadArrowEnds(arrow, drawn);
    return {
      svg: svgArrow(
        arrow,
        drawn,
        arrowSurface,
        tabFont,
        labelsOf(),
        'lvd-minimap-ko-',
        undefined,
        undefined,
        tabFinish,
      ),
      reach: routeBehindQueryRect(from, to),
      surface: arrowSurface,
    };
  };
  const arrows = parts.arrows.geometryFor(drawn, key, (el) =>
    drawArrow(el as ArrowElement, pageSurfaces?.get(el.id) ?? surface),
  );
  for (const el of drawn) {
    if (el.type !== 'arrow') continue;
    const arrowSurface = pageSurfaces?.get(el.id) ?? surface;
    let part = arrows.get(el.id)!;
    if (part.surface !== arrowSurface) arrows.set(el.id, (part = drawArrow(el, arrowSurface)));
    markup.push(part.svg);
    corners.push(endpointPosition(el.from, drawn), endpointPosition(el.to, drawn));
  }
  // One image over the padded content box (MinimapMap's minimapPicture).
  return minimapPicture(boundsOfPoints(corners), `${svgShadowDefs(elements)}${markup.join('')}`);
}

// An element as the Map draws it: its label left out (docs/specs/008-canvas/minimap.md "What it shows").
export function withoutLabel(el: Element): Element {
  if (!('label' in el) && !('richText' in el)) return el;
  const {
    label: _label,
    richText: _richText,
    ...rest
  } = el as Element & { label?: unknown; richText?: unknown };
  return rest;
}
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
  // Drawn as the elements settle, not per frame of a gesture (docs/specs/008-canvas/canvas-performance.md),
  // and deferred: the change that settles them (a drag's release) commits first, and the Map's picture,
  // rebuilt and re-parsed for the whole board, follows as its own render.
  // On mount the picture is deferred too: the first render draws none (NO_ELEMENTS), so opening a
  // board mounts it first and the Map's whole-board picture follows in a background render.
  const elements = useDeferredValue(useSettledElements(liveElements), NO_ELEMENTS);

  // Which paper the canvas is (light / dark), from the SAME context the canvas
  // elements read (docs/specs/008-canvas/minimap.md "Fidelity"). The renderer
  // resolves every unstyled colour against it, so a Behaviour card that is a
  // dark card on a dark canvas is a dark card here too, not the light skin.
  const surface = useCanvasSurface();
  const tabFinish = useTabFinish();
  const chartPalette = useCanvasChartPalette();
  const viewColors = selectionBoxColors(accentColor, surface);
  // Re-render once the async icon catalogues land so Technology marks pop in.
  const iconsLoaded = useIconCatalogs();
  // An article's writing laid out for the first time: its lines of text can be drawn now.
  const laidOut = useArticleLaidOutSeq();
  // One pass builds the full-fidelity markup (the SAME headless renderer the
  // exports / live image use — real colours, silhouettes, tables, freehand,
  // icon glyphs, rotation, curved arrows) plus the content bounds; recomputed
  // only when elements, the tab font or the icon catalogues change —
  // panning/zooming re-renders just the viewport overlay below. It is shown as ONE image of that markup
  // (docs/specs/008-canvas/minimap.md "What it shows"), not injected as live elements: on a large
  // board a live copy doubled the page and slowed every gesture
  // (docs/specs/008-canvas/canvas-performance.md "The Map is one image"). It draws no labels: at the
  // Map's size they are a pixel or two tall, and laying them out was half the picture's cost.
  const [parts] = useState(minimapParts);
  const { picture, bounds } = useMemo(
    () =>
      minimapBuild(parts, elements, {
        pages,
        writing,
        tabFont,
        tabFinish,
        iconsLoaded,
        surface,
        chartPalette,
      }),
    // oxlint-disable-next-line react/exhaustive-deps -- `writing` changes with the documents' text, which the bars read off the editors; `laidOut` marks an article laid out for the first time
    [
      elements,
      pages,
      tabFont,
      tabFinish,
      iconsLoaded,
      surface,
      chartPalette,
      writing,
      laidOut,
      parts,
    ],
  );

  if (!bounds) return null; // Nothing to map.

  return (
    <MovablePanel
      helpArticle="minimap"
      // How a fit finds the Map to keep the content clear of it (@liveworkspace/workbench/lib/fit-clear-of-panel.ts).
      dataTourId="minimap"
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
      <MinimapMap
        picture={picture}
        bounds={bounds}
        size={size}
        viewportOffset={viewportOffset}
        viewportZoom={viewportZoom}
        setViewportOffset={setViewportOffset}
        setViewportZoom={setViewportZoom}
        zoomMin={ZOOM_MIN}
        zoomMax={ZOOM_MAX}
        mainSize={mainSize}
        paperColor={paperColor}
        dimOutside={dimOutside}
        dark={surface === 'dark'}
        viewColors={viewColors}
      />
    </MovablePanel>
  );
}
