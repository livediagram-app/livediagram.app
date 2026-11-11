// What the image exports share (export-tab.ts): their options and the tab's backdrop pattern. Split out of
// export-tab.ts, which re-exports ImageExportOpts and EXPORT_PATTERN_COLOR.

import type { LaidOutPage, CanvasSurface, ResolveTabWindow, Tab } from '@livedesign/design';
import { r2 } from '@livedesign/design';
import { backgroundPatternTile } from './canvas-backgrounds';
import type { ExportImageMap } from './export-tab-images';
import type { MotionFrameCache } from './page-motion-canvas';

// Shared options for the image exports (PNG / SVG / PDF). `pattern` paints the tab's backdrop pattern (grid / dots /
// …); on by default, the user can switch it off in the Export dialog.
// `images` carries pre-loaded bitmaps (keyed by imageId) so image / avatar
// elements embed their photo instead of a placeholder; absent ids (or no map)
// fall back to the placeholder. Build it with loadTabImages (export-tab-images).
// `hiddenLayers` INCLUDES layers the user has hidden (docs/specs/006-design/layers.md); off by default
// so the export matches what the canvas shows.
export type ImageExportOpts = {
  pattern?: boolean;
  hiddenLayers?: boolean;
  images?: ExportImageMap;
  // Embedded @font-face rules for the faces this tab uses (docs/specs/004-interface-design/fonts.md), from
  // embeddedFontFaceCss. Absent = the SVG falls back to declaring the
  // Google stylesheet by @import, which only a browser opening the file
  // directly will honour.
  fontCss?: string;
  // One page to export (docs/specs/007-editor/pages-mode.md "Export"): the
  // frame becomes exactly its sheet, painted with its background; the tab's own
  // backdrop does not apply.
  page?: LaidOutPage;
  // A logo page's plain paper left see-through (docs/specs/007-editor/logo-pages.md "Export"):
  // PNG and SVG pass it, PDF never does.
  transparentPaper?: boolean;
  // Slides' animated backgrounds painted so far in this export, so a background repeated across a
  // deck is painted once (lib/page-motion-canvas.ts). Absent, each page paints its own.
  motionFrames?: MotionFrameCache;
  // A slide's animated background drawn as its still gradient (a thumbnail): no frame is painted or
  // embedded. The Layouts tab's tiles pass it, as a full-size picture in each 120 px tile was
  // megabytes of markup for nothing seen.
  stillBackground?: boolean;
  // A stored tab window's frame named for its tab (docs/specs/009-elements/tab-window.md, retired); without it the
  // frame reads "Tab Window".
  resolveTabWindow?: ResolveTabWindow;
  // An element exported on its own from Inspect (docs/specs/007-editor/wireframe-pages.md "The Inspect panel"):
  // `scale` (a PNG's pixels per px, an SVG's size), `padding` round the content (absent: EXPORT_PADDING),
  // `transparent` leaves the ground clear, and `surface` is the paper its unpainted parts take their ink from (the
  // page it came off, rather than the tab's backdrop). A page export ignores all but `scale`.
  scale?: number;
  padding?: number;
  transparent?: boolean;
  surface?: CanvasSurface;
  // A photo page's elements alone (docs/specs/031-photo/photo-pages.md "Elements on top"): the page's own paint (its
  // picture's preview, or the checkerboard while there is none) left out, as a Photo export draws them over the
  // photo's full-size composite. Only a photo page passes it: a device's paint holds its screen's clip.
  elementsOnly?: boolean;
};
// Default backdrop pattern colour when a tab leaves it unset (matches the
// editor's fallback).
export const EXPORT_PATTERN_COLOR = '#cbd5e1'; // slate-300

// One <pattern> id for the export SVG / canvas rasterisation.
const BG_PATTERN_ID = 'lvd-export-bg';

// The tab's backdrop pattern as an SVG <defs> + a fill ref, or null when the
// pattern is off / blank / unset. Shared by the SVG export (inline) and the
// PNG/PDF rasteriser. Animated patterns + Blank return null (no static image).
export function backgroundPatternDefs(
  tab: Tab,
  opts: ImageExportOpts,
): { defs: string; fill: string; width: number; height: number; content: string } | null {
  if (opts.pattern === false || !tab.backgroundPattern) return null;
  const tile = backgroundPatternTile(
    tab.backgroundPattern,
    tab.patternColor ?? EXPORT_PATTERN_COLOR,
    tab.backgroundOpacity ?? 1,
    tab.backgroundPatternScale ?? 1,
  );
  if (!tile) return null;
  const defs =
    `<defs><pattern id="${BG_PATTERN_ID}" patternUnits="userSpaceOnUse" ` +
    `width="${r2(tile.width)}" height="${r2(tile.height)}">${tile.content}</pattern></defs>`;
  return { defs, fill: `url(#${BG_PATTERN_ID})`, ...tile };
}
