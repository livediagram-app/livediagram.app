'use client';

import { useDeferredValue, useMemo } from 'react';
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
  svgShadowDefs,
  type Element,
  type Point,
} from '@livediagram/document';
import { framesFirst, ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { useIconCatalogs } from '@liveworkspace/workbench/hooks/ui/useIconCatalogs';
import { MovablePanel, type MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import type { MapSize } from '@/lib/user-preferences';
import { useCanvasChartPalette, useCanvasSurface } from '@liveworkspace/workbench/components/canvas/CanvasSurfaceContext';
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
// An element as the Map draws it: its label left out (docs/specs/008-canvas/minimap.md "What it shows").
function withoutLabel(el: Element): Element {
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
  const { picture, bounds } = useMemo(() => {
    const drawn = elements.map(withoutLabel);
    const corners: Point[] = [];
    const parts: string[] = [];
    // The resolvers find nothing until the catalogue chunk lands, which
    // re-runs the build with the glyphs.
    const resolveIconArt = iconsLoaded ? resolveIconArtLoaded : NO_ART;
    const resolveStickerArt = iconsLoaded ? resolveStickerArtLoaded : NO_ART;
    const labels = arrowLabelPass(drawn, {
      fontFamilyOf: (a) => arrowLabelFontStack(a, tabFont, tabFinish),
    });
    // Boxed first (frames behind their contents), then arrows on top —
    // matching the canvas z-order.
    // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
    const backdrops = sketchBackdropIds(drawn, tabFinish);
    for (const el of framesFirst(drawn)) {
      if (el.type === 'arrow') continue;
      if (!isBoxed(el)) continue;
      parts.push(
        svgBoxed(el, {
          resolveIconArt,
          resolveStickerArt,
          tabFont,
          tabFinish,
          sketchBackdrop: backdrops.has(el.id),
          surface,
          chartPalette,
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
          surface,
          tabFont,
          labels,
          'lvd-minimap-ko-',
          undefined,
          undefined,
          tabFinish,
        ),
      );
      corners.push(endpointPosition(el.from, drawn), endpointPosition(el.to, drawn));
    }
    // One image over the padded content box (MinimapMap's minimapPicture).
    return minimapPicture(boundsOfPoints(corners), `${svgShadowDefs(elements)}${parts.join('')}`);
  }, [elements, tabFont, tabFinish, iconsLoaded, surface, chartPalette]);

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
