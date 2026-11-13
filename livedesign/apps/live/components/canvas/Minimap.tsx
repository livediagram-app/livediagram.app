'use client';

import { CANVAS_PAPER } from '@/lib/page-paint';
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
  elementIndexFor,
  routeBehindQueryRect,
  spreadArrowEnds,
  type ArrowElement,
  type Element,
  type LaidOutPage,
  type Point,
  type Rect,
} from '@livedesign/design';
import { pageExportFrame } from '@/lib/export-page';
import { framesFirst, ZOOM_MIN, zoomMax } from '@/lib/canvas';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { useIconCatalogs } from '@liveworkspace/workbench/hooks/ui/useIconCatalogs';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import type { MapSize } from '@/lib/user-preferences';
import { useCanvasChartPalette, useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { useTabFinish } from '@/components/canvas/CanvasFinishContext';
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
  // The tab default face (docs/specs/004-interface-design/fonts.md): the miniature paints what the canvas
  // paints, so a canvas set in the marker face looks that way in the map too.
  tabFont?: string;
  viewportOffset: { x: number; y: number };
  viewportZoom: number;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  setViewportZoom: (zoom: number) => void;
  // The canvas <main>'s size, measured by the Canvas that owns it. Not observed here: the map renders
  // INSIDE <main>, and a child's layout effect runs before its parent's ref attaches, so a map mounted
  // in the same commit as the canvas (any design opened with enough elements) would read a null ref,
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

// The picture's parts carried over from the last build (docs/specs/008-canvas/canvas-performance.md "The Map draws
// what changed"): each element as drawn (its label left out) and each box's markup, by the element; each arrow's
// markup, for the arrows no change reaches (the layer's arrow geometry cache, the same reads). A commit that moves
// one box draws that box and the arrows it reached, not the board. The pages are drawn every build: there are few.
type ArrowPart = { svg: string; reach: Rect; surface: string };
export function minimapParts() {
  return {
    plain: new WeakMap<Element, Element>(),
    boxed: new WeakMap<Element, { key: string; svg: string }>(),
    arrows: createArrowGeometryCache<Element, ArrowPart>({
      isArrow: (el) => el.type === 'arrow',
      ends: (arrow) => [(arrow as ArrowElement).from, (arrow as ArrowElement).to],
      reach: (part) => part.reach,
      // No finish routes an arrow here from the shape round it: this model's mind nodes carry no parent link.
      structural: () => false,
    }),
  };
}

type MinimapBuildContext = {
  pages: readonly LaidOutPage[] | undefined;
  tabFont: string | undefined;
  tabFinish: NonNullable<Parameters<typeof svgBoxed>[1]>['tabFinish'];
  iconsLoaded: boolean;
  surface: NonNullable<NonNullable<Parameters<typeof svgBoxed>[1]>['surface']>;
  chartPalette: NonNullable<Parameters<typeof svgBoxed>[1]>['chartPalette'];
};

// The Map's picture for `elements` (see Minimap), drawing afresh only the parts `parts` cannot carry over.
export function minimapBuild(
  parts: ReturnType<typeof minimapParts>,
  elements: Element[],
  { pages, tabFont, tabFinish, iconsLoaded, surface, chartPalette }: MinimapBuildContext,
) {
  const drawn = elements.map((el) => {
    let plain = parts.plain.get(el);
    if (!plain) parts.plain.set(el, (plain = withoutLabel(el)));
    return plain;
  });
  // What every part reads beyond its element and its page: a part drawn under another is drawn again.
  const key = `${tabFont}|${tabFinish}|${iconsLoaded}|${surface}|${JSON.stringify(chartPalette ?? null)}`;
  const corners: Point[] = [];
  const markup: string[] = [];
  // The pages first, under everything: each sheet in its own paint with a crisp outline, so
  // even an empty page shows where it is.
  const paper = CANVAS_PAPER[surface === 'dark' ? 'dark' : 'light'];
  const outline = surface === 'dark' ? '#94a3b8' : '#64748b';
  for (const page of pages ?? []) {
    const { x, y, width, height } = page.rect;
    markup.push(
      pageExportFrame(page, { paper, idPrefix: 'lvd-minimap-page' }).backgroundSvg +
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
  // Boxed first (frames behind their contents), then arrows on top,
  // matching the canvas z-order.
  // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
  const backdrops = sketchBackdropIds(drawn, tabFinish);
  for (const el of framesFirst(drawn)) {
    if (el.type === 'arrow') continue;
    if (!isBoxed(el)) continue;
    const boxSurface = pageSurfaces?.get(el.id) ?? surface;
    const ground = chartGrounds?.get(el.id);
    // A box's page and what its chart sits on can change with no change to it, so both are in its key.
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
  let index: ReturnType<typeof elementIndexFor> | null = null;
  const arrowPart = (arrow: ArrowElement): ArrowPart => {
    const arrowSurface = pageSurfaces?.get(arrow.id) ?? surface;
    // svgArrow's ends: the converging-fan spread, as the canvas draws them.
    const { from, to } = spreadArrowEnds(arrow, (index ??= elementIndexFor(drawn)));
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
  const arrows = parts.arrows.geometryFor(drawn, key, (el) => arrowPart(el as ArrowElement));
  for (const el of drawn) {
    if (el.type !== 'arrow') continue;
    let part = arrows.get(el.id)!;
    // An arrow's page can change with no change on the board (the pages' own fills): drawn again, and kept in the
    // map the cache carries over (the one it returned).
    if (part.surface !== (pageSurfaces?.get(el.id) ?? surface)) {
      part = arrowPart(el);
      arrows.set(el.id, part);
    }
    markup.push(part.svg);
    corners.push(endpointPosition(el.from, drawn), endpointPosition(el.to, drawn));
  }
  // One image over the padded content box (MinimapMap's minimapPicture).
  return minimapPicture(boundsOfPoints(corners), `${svgShadowDefs(elements)}${markup.join('')}`);
}
export function Minimap({
  elements: liveElements,
  pages,
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
        tabFont,
        tabFinish,
        iconsLoaded,
        surface,
        chartPalette,
      }),
    [elements, pages, tabFont, tabFinish, iconsLoaded, surface, chartPalette, parts],
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
        zoomMax={zoomMax()}
        mainSize={mainSize}
        paperColor={paperColor}
        dimOutside={dimOutside}
        dark={surface === 'dark'}
        viewColors={viewColors}
      />
    </MovablePanel>
  );
}
