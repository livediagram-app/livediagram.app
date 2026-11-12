// What the image exports share (export-tab.ts): their options and the tab's backdrop pattern. Split out of
// export-tab.ts, which re-exports ImageExportOpts and EXPORT_PATTERN_COLOR.

import { r2, type Tab } from '@livediagram/document';
import { backgroundPatternTile } from './canvas-backgrounds';
import type { ExportImageMap } from './export-tab-images';

// Shared options for the image exports (PNG / SVG / PDF). `isometric` tilts
// the rendered scene into the editor's isometric projection (docs/specs/008-canvas/isometric-view.md / 48),
// off by default. `pattern` paints the tab's backdrop pattern (grid / dots /
// …); on by default, the user can switch it off in the Export dialog.
// `images` carries pre-loaded bitmaps (keyed by imageId) so image / avatar
// elements embed their photo instead of a placeholder; absent ids (or no map)
// fall back to the placeholder. Build it with loadTabImages (export-tab-images).
// `hiddenLayers` INCLUDES layers the user has hidden (docs/specs/006-document/layers.md); off by default
// so the export matches what the canvas shows.
export type ImageExportOpts = {
  isometric?: boolean;
  pattern?: boolean;
  hiddenLayers?: boolean;
  images?: ExportImageMap;
  // Embedded @font-face rules for the faces this tab uses (docs/specs/004-interface-design/fonts.md), from
  // embeddedFontFaceCss. Absent = the SVG falls back to declaring the
  // Google stylesheet by @import, which only a browser opening the file
  // directly will honour.
  fontCss?: string;
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
