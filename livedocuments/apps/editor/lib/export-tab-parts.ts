// What the image exports share (export-tab.ts): their options, a page's drawing-zone clips and the tab's
// backdrop pattern. Split out of export-tab.ts, which re-exports ImageExportOpts and EXPORT_PATTERN_COLOR.

import {
  articlesOf,
  drawingZoneClips,
  pagesOf,
  isDrawingElement,
  layOutPages,
  type Element,
  type LaidOutPage,
  type PageRect,
  type ResolveTabWindow,
  type Tab,
} from '@livedocuments/document';
import { r2 } from '@livedocuments/document';
import { backgroundPatternTile } from './canvas-backgrounds';
import type { ExportImageMap } from './export-tab-images';
import type { MotionFrameCache } from './page-motion-canvas';
import type { PageWriting } from './article/article-export';

// Shared options for the image exports (PNG / SVG / PDF). `pattern` paints the tab's backdrop pattern (grid / dots /
// …); on by default, the user can switch it off in the Export dialog.
// `images` carries pre-loaded bitmaps (keyed by imageId) so image / avatar
// elements embed their photo instead of a placeholder; absent ids (or no map)
// fall back to the placeholder. Build it with loadTabImages (export-tab-images).
// `hiddenLayers` INCLUDES layers the user has hidden (docs/specs/006-document/layers.md); off by default
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
  // Slides' animated backgrounds painted so far in this export, so a background repeated across a
  // deck is painted once (lib/page-motion-canvas.ts). Absent, each page paints its own.
  motionFrames?: MotionFrameCache;
  // A slide's animated background drawn as its still gradient (a thumbnail): no frame is painted or
  // embedded. The Layouts tab's tiles pass it, as a full-size picture in each 120 px tile was
  // megabytes of markup for nothing seen.
  stillBackground?: boolean;
  // A stored tab window's frame named for its tab (docs/specs/009-elements/tab-window.md); without it the frame reads
  // "Tab Window".
  resolveTabWindow?: ResolveTabWindow;
  // A page's writing as estimated without a browser (svg-render-pages.ts pagesWithWriting), drawn where the editor has
  // not laid that article out (no handle): the split view's other pane passes it. SVG only.
  estimatedWriting?: (page: LaidOutPage) => string | undefined;
};
// A page export's drawing-zone clips (docs/specs/007-editor/article-pages.md "Zones"): what pokes
// past a drawing zone's edge is cut off in an export as on the canvas.
export function exportZoneClips(tab: Tab, page: LaidOutPage | undefined): Map<string, PageRect> {
  if (!page) return new Map();
  return drawingZoneClips(
    layOutPages(pagesOf(tab)),
    articlesOf(tab),
    tab.elements,
    isDrawingElement,
  );
}

// An element's SVG markup cut off at its drawing zone, when it has one.
export function svgZoneClipped(id: string, svg: string, clips: Map<string, PageRect>): string {
  const r = clips.get(id);
  if (!r || !svg) return svg;
  const cid = `lvd-zc-${id}`.replace(/[^a-zA-Z0-9-]/g, '');
  return `<clipPath id="${cid}"><rect x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(r.width)}" height="${r2(r.height)}"/></clipPath><g clip-path="url(#${cid})">${svg}</g>`;
}

// An article's margin-note marker (docs/specs/007-editor/article-pages.md "Comments and actions"):
// review furniture, like a comment badge, never part of what the page prints.
export const isArticleNoteMarker = (el: Element) => el.type === 'article-note';

// The font ids an export declares, with an article page's writing's faces added.
export function withWritingFonts(
  ids: string[],
  writing: Pick<PageWriting, 'fonts'> | null,
): string[] {
  return writing ? [...new Set([...ids, ...writing.fonts])] : ids;
}

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
