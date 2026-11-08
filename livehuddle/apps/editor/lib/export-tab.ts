// Tab export helpers — one entry per format the user can pick from
// the Export overlay. All four return a Promise<Blob> so the caller
// can plug them into a single download helper without branching on
// the MIME type.
//
// Scope: each export is a snapshot of a single Tab — its name, theme,
// background, and all elements. Cross-tab links and per-element
// comments are preserved in the JSON export but flattened or
// omitted in the visual ones (PNG, PDF) where they have no natural
// rendering.

import {
  isBoxed,
  paintOrder,
  exportFontIds,
  type BoxedElement,
  type Tab,
} from '@livehuddle/document';
// Shared SVG render helpers: in the document package so the api's
// tab render reuses the same element drawing. The canvas / backdrop
// orchestration below stays here and imports the per-element drawers + helpers.
import {
  canvasSurface,
  boxedNeedsSvgRaster,
  contentBounds,
  EXPORT_BG,
  EXPORT_PADDING,
  r2,
  supportsShadow,
  sketchBackdropIds,
  svgBoxed,
  svgFontDefs,
  svgShadowDefs,
  xmlEscape,
} from '@livehuddle/document';
import { backgroundPatternTile } from './canvas-backgrounds';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { drawBoxed } from './export-tab-canvas-draw';
import { svgRetiredArrowMarkup } from './retired-arrow-card';
import type { ExportImageMap } from './export-tab-images';

// Shared options for the image exports (PNG / SVG / PDF). `pattern` paints the tab's backdrop pattern (grid / dots /
// …); on by default, the user can switch it off in the Export dialog.
// `images` carries pre-loaded bitmaps (keyed by imageId) so image / avatar
// elements embed their photo instead of a placeholder; absent ids (or no map)
// fall back to the placeholder. Build it with loadTabImages (export-tab-images).
export type ImageExportOpts = {
  pattern?: boolean;
  images?: ExportImageMap;
  // Embedded @font-face rules for the faces this tab uses (docs/specs/004-interface-design/fonts.md), from
  // embeddedFontFaceCss. Absent = the SVG falls back to declaring the
  // Google stylesheet by @import, which only a browser opening the file
  // directly will honour.
  fontCss?: string;
};

// Re-export so callers (the export dialog) get the loader from the same
// `@/lib/export-tab` barrel they already import the exporters from.
export { loadTabImages } from './export-tab-images';

// Webfont embedding for downloads (docs/specs/004-interface-design/fonts.md) — the bytes travel with the file.
import { embeddedFontFaceCss } from './export-fonts';
// Default backdrop pattern colour when a tab leaves it unset (matches the
// editor's fallback).
export const EXPORT_PATTERN_COLOR = '#cbd5e1'; // slate-300

// One <pattern> id for the export SVG / canvas rasterisation.
const BG_PATTERN_ID = 'lvd-export-bg';

// The tab's backdrop pattern as an SVG <defs> + a fill ref, or null when the
// pattern is off or None. Shared by the SVG export (inline) and the
// PNG/PDF rasteriser. An unset pattern draws the theme's floor, as the canvas does.
function backgroundPatternDefs(
  tab: Tab,
  opts: ImageExportOpts,
): { defs: string; fill: string; width: number; height: number; content: string } | null {
  if (opts.pattern === false) return null;
  const tile = backgroundPatternTile(
    tab.backgroundPattern ?? 'grid',
    tab.patternColor ?? EXPORT_PATTERN_COLOR,
    tab.backgroundOpacity ?? 1,
    tab.backgroundPatternScale ?? 1,
    tab.backgroundColor ?? EXPORT_BG,
  );
  if (!tile) return null;
  const defs =
    `<defs><pattern id="${BG_PATTERN_ID}" patternUnits="userSpaceOnUse" ` +
    `width="${r2(tile.width)}" height="${r2(tile.height)}">${tile.content}</pattern></defs>`;
  return { defs, fill: `url(#${BG_PATTERN_ID})`, ...tile };
}

// Rasterise an SVG string to an Image (for drawing the pattern onto the PNG /
// PDF canvas). Browser-only; the canvas renderer is never reached in non-DOM
// test runs (no 2D context there).
function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('pattern render failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// ---------------------------------------------------------------------
// PNG / PDF helpers — shared canvas rendering
// ---------------------------------------------------------------------

// The largest canvas side every browser draws (Safari and Firefox stop at 16384 px; Chrome 32767).
export const MAX_EXPORT_CANVAS_SIDE = 16384;
// How far past a whole pixel a size may be from float arithmetic alone (1024 x 2.0000000001) and still count as
// that whole pixel when the canvas is sized.
const PART_PIXEL_NOISE = 1e-6;

/** The scale an image export draws at: `wanted`, lowered so neither side of a `w` x `h` drawing
 *  passes MAX_EXPORT_CANVAS_SIDE. */
export function exportScale(wanted: number, w: number, h: number): number {
  const longest = Math.max(w, h, 1);
  return Math.min(wanted, MAX_EXPORT_CANVAS_SIDE / longest);
}

// The scale each rendered canvas was drawn at, so a caller can size it in CSS
// px (the single-page PDF prints it at 0.75 pt per CSS px, not per pixel).
const renderedScale = new WeakMap<HTMLCanvasElement, number>();

/** The scale `renderTabToCanvas` drew this canvas at (CSS px x scale = pixels); 1 if unknown. */
export function renderedExportScale(canvas: HTMLCanvasElement): number {
  return renderedScale.get(canvas) ?? 1;
}

export async function renderTabToCanvas(
  tab: Tab,
  opts: { scale?: number } & ImageExportOpts = {},
): Promise<HTMLCanvasElement> {
  // `ordered` is the canvas's paint order, frames first (docs/specs/006-document/layers.md "Stacking").
  const els = tab.elements;
  const ordered = paintOrder(tab.elements);
  // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
  const backdrops = sketchBackdropIds(els, tab.finish);
  const bounds = contentBounds(els);
  const pad = EXPORT_PADDING;
  const draw = bounds;
  // 2x for crisp output, lowered so no side passes the largest canvas every browser draws.
  const scale = exportScale(opts.scale ?? 2, draw.w + pad * 2, draw.h + pad * 2);
  const w = (draw.w + pad * 2) * scale;
  const h = (draw.h + pad * 2) * scale;
  const canvas = document.createElement('canvas');
  // A part pixel rounds up, so a part-pixel size (a box of 360.5 x 55.9 with its padding) keeps its last row
  // and column; a hair under a whole one (float noise) stays whole, and no side passes the canvas limit.
  const pixels = (n: number) =>
    Math.max(1, Math.min(MAX_EXPORT_CANVAS_SIDE, Math.ceil(n - PART_PIXEL_NOISE)));
  canvas.width = pixels(w);
  canvas.height = pixels(h);
  renderedScale.set(canvas, scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  // Background colour, painted across the whole canvas. The pattern (if on) sits over it.
  const bgColor = tab.backgroundColor ?? EXPORT_BG;
  // Elements that carry no colours of their own are drawn in the ink of the
  // paper being exported onto (docs/specs/007-editor/editor-app.md), so a dark canvas exports dark-canvas
  // elements rather than pale ones.
  const surface = canvasSurface(bgColor);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w / scale, h / scale);
  const bg = backgroundPatternDefs(tab, opts);
  if (bg) {
    const wu = w / scale;
    const hu = h / scale;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.floor(w)}" height="${Math.floor(h)}" viewBox="0 0 ${r2(wu)} ${r2(hu)}">` +
      `${bg.defs}<rect width="${r2(wu)}" height="${r2(hu)}" fill="${bg.fill}"/></svg>`;
    try {
      const img = await svgToImage(svg);
      ctx.drawImage(img, 0, 0, wu, hu);
    } catch {
      // Pattern is decorative — a render failure must never abort the export.
    }
  }
  // Position the content min-corner at the padding offset.
  ctx.translate(pad - draw.x, pad - draw.y);

  // `ordered` keeps frame sections behind their contents
  // (docs/specs/008-canvas/canvas-and-palette.md).
  const resolveImage = opts.images ? (id: string) => opts.images!.get(id)?.image : undefined;
  // Elements the canvas drawers can't reproduce (tables, freehand, shape
  // silhouettes, rotation, icon glyphs — boxedNeedsSvgRaster) rasterise via
  // the SAME svg markup the SVG export emits, so the PNG/PDF output can't
  // drift from it. Pre-rendered async here (the draw loop below stays
  // sync), padded for stroke overflow — and for the rotated bounding box
  // when the element carries a rotation, since svgBoxed bakes the rotation
  // into the markup and it sweeps outside the unrotated box. A failed
  // rasterise falls back to drawBoxed's plain box.
  // The tab default face (docs/specs/004-interface-design/fonts.md) every element without its own inherits.
  const tabFont = tab.font;
  // Webfont bytes for the faces in play. A rasterised fragment is loaded as
  // an <img>, which blocks external resources outright — so a marker note
  // would come back in the fallback face unless the font travels INSIDE the
  // markup. Fetched once here and inlined into every fragment below.
  const fontCss =
    opts.fontCss ?? (await embeddedFontFaceCss(exportFontIds(els, tab.font, tab.finish)));
  // The canvas drawers paint through the DOM's own font set, so wait for it
  // to settle — rasterising mid-swap bakes the fallback face into the PNG.
  await document.fonts?.ready;
  const fontDefs = fontCss ? `<defs><style type="text/css">${fontCss}</style></defs>` : '';
  const rasterImages = new Map<string, { image: HTMLImageElement; pad: number }>();
  for (const el of els) {
    if (el.type === 'arrow' || !isBoxed(el)) continue;
    if (!boxedNeedsSvgRaster(el, resolveIconArtLoaded, resolveStickerArtLoaded, tab.finish))
      continue;
    const diag = Math.hypot(el.width, el.height);
    // A shadow sweeps outside the box by its offset + blur (docs/specs/008-canvas/element-shadows.md);
    // grow the raster pad so it isn't clipped, and inline its filter
    // def (the fragment has no document <defs> to resolve against).
    const shadow = supportsShadow(el) && el.shadow ? el.shadow : undefined;
    const shadowPad = shadow
      ? Math.max(Math.abs(shadow.offsetX), Math.abs(shadow.offsetY)) + shadow.blur
      : 0;
    const pad = (el.rotation ? (diag - Math.min(el.width, el.height)) / 2 + 2 : 2) + shadowPad;
    const w = el.width + pad * 2;
    const h = el.height + pad * 2;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(w * scale)}" height="${r2(h * scale)}"` +
      ` viewBox="${r2(el.x - pad)} ${r2(el.y - pad)} ${r2(w)} ${r2(h)}">` +
      `${fontDefs}${svgShadowDefs([el])}${svgBoxed(el, {
        resolveIconArt: resolveIconArtLoaded,
        resolveStickerArt: resolveStickerArtLoaded,
        // An image drawn this way (a shadow, a turn, an accent edge, a finish) embeds its bytes
        // like the SVG export, not the empty-image placeholder.
        resolveImageHref: (id) => opts.images?.get(id)?.href,
        tabFont,
        tabFinish: tab.finish,
        sketchBackdrop: backdrops.has(el.id),
        surface,
      })}</svg>`;
    try {
      rasterImages.set(el.id, { image: await svgToImage(svg), pad });
    } catch {
      // Fall through to drawBoxed's plain box below.
    }
  }
  // One pass in the canvas's paint order (docs/specs/006-document/layers.md): stored arrows and boxes
  // interleave by array order, so an arrow sent behind a box stays behind it.
  // A stored arrow's placeholder (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine")
  // rasterises from the SAME markup the SVG export emits, batched: each run of
  // consecutive arrows becomes one full-size layer. End resolution keeps
  // the FULL list, so an arrow pinned to a hidden element still lands where
  // the canvas draws it.
  const ax = bounds.x - pad;
  const ay = bounds.y - pad;
  const aw = bounds.w + pad * 2;
  const ah = bounds.h + pad * 2;
  let arrowRun: string[] = [];
  const flushArrows = async () => {
    if (arrowRun.length === 0) return;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(aw * scale)}" height="${r2(ah * scale)}"` +
      ` viewBox="${r2(ax)} ${r2(ay)} ${r2(aw)} ${r2(ah)}">${fontDefs}${arrowRun.join('')}</svg>`;
    arrowRun = [];
    ctx.drawImage(await svgToImage(svg), ax, ay, aw, ah);
  };
  for (const el of ordered) {
    if (el.type === 'arrow') {
      arrowRun.push(
        svgRetiredArrowMarkup(el, tab.elements, { surface, tabFont, tabFinish: tab.finish }),
      );
      continue;
    }
    await flushArrows();
    drawOne(ctx, el);
  }
  await flushArrows();
  return canvas;

  function drawOne(c: CanvasRenderingContext2D, el: BoxedElement) {
    const raster = rasterImages.get(el.id);
    if (raster) {
      // The raster bakes the element's opacity into its markup.
      c.globalAlpha = 1;
      c.drawImage(
        raster.image,
        el.x - raster.pad,
        el.y - raster.pad,
        el.width + raster.pad * 2,
        el.height + raster.pad * 2,
      );
      c.globalAlpha = 1;
      return;
    }
    drawBoxed(c, el, resolveImage, 1, tabFont, surface);
  }
}

// --- Shared boxed-element export description --------------------------
//
// Both visual exporters (the PNG canvas renderer + the SVG renderer)
// make the SAME decisions — which silhouette a boxed element maps to,
// its fill / stroke defaults, and where its label sits — then draw with
// their own primitives. Encoding that decision ONCE here keeps the two
// renderers from drifting (a new export-visible shape or a tweaked
// default lands in one place, not two).

// Exported so the export dialog can render a live preview of the image
// export (docs/specs/010-palette/style-presets.md): same SVG the .svg download produces, and PNG / PDF
// rasterise the same content, so one SVG preview faithfully represents all
// three image formats under the current pattern option.
export function renderTabToSvg(tab: Tab, opts: ImageExportOpts = {}): string {
  // The same paint order as the canvas renderer above.
  const els = tab.elements;
  const ordered = paintOrder(tab.elements);
  // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
  const backdrops = sketchBackdropIds(els, tab.finish);
  const bounds = contentBounds(els);
  const pad = EXPORT_PADDING;
  const draw = bounds;
  const vbX = draw.x - pad;
  const vbY = draw.y - pad;
  const vbW = draw.w + pad * 2;
  const vbH = draw.h + pad * 2;
  const bgColor = tab.backgroundColor ?? EXPORT_BG;
  // See the PNG path: unpainted elements take the exported paper's ink.
  const surface = canvasSurface(bgColor);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW)}" height="${r2(vbH)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
  );
  parts.push(
    `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${xmlEscape(bgColor)}"/>`,
  );
  // Typefaces (docs/specs/004-interface-design/fonts.md): the real bytes when the caller pre-fetched them
  // (a download, which must stand alone), else a declaration of the Google
  // stylesheet (the live preview, where the page has the faces already).
  const fontDefs = opts.fontCss
    ? `<defs><style type="text/css">${opts.fontCss}</style></defs>`
    : svgFontDefs(exportFontIds(els, tab.font, tab.finish));
  if (fontDefs) parts.push(fontDefs);
  // Element-shadow filter defs (docs/specs/008-canvas/element-shadows.md); empty string when none.
  const shadowDefs = svgShadowDefs(els);
  if (shadowDefs) parts.push(shadowDefs);
  // Backdrop pattern (docs/specs/010-palette/style-presets.md) over the colour.
  const bg = backgroundPatternDefs(tab, opts);
  if (bg) {
    parts.push(bg.defs);
    parts.push(
      `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${bg.fill}"/>`,
    );
  }
  // The canvas's paint order (docs/specs/006-document/layers.md "Stacking"): a stored arrow's placeholder
  // interleaves with the boxes by array order, as on the canvas.
  const resolveImageHref = opts.images ? (id: string) => opts.images!.get(id)?.href : undefined;
  {
    const inner: string[] = [];
    for (const el of ordered) {
      if (el.type === 'arrow') {
        inner.push(
          svgRetiredArrowMarkup(el, tab.elements, {
            surface,
            tabFont: tab.font,
            tabFinish: tab.finish,
          }),
        );
        continue;
      }
      inner.push(
        svgBoxed(el, {
          resolveImageHref,
          resolveIconArt: resolveIconArtLoaded,
          resolveStickerArt: resolveStickerArtLoaded,
          tabFont: tab.font,
          tabFinish: tab.finish,
          sketchBackdrop: backdrops.has(el.id),
          surface,
        }),
      );
    }
    parts.push(inner.join('\n'));
  }
  parts.push('</svg>');
  return parts.join('\n');
}

// A downloaded SVG carries its own typefaces: the reader hasn't got
// Permanent Marker installed, and an @import is dead in an offline viewer.
export async function exportTabAsSvg(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  const els = tab.elements;
  const fontCss =
    opts.fontCss ?? (await embeddedFontFaceCss(exportFontIds(els, tab.font, tab.finish)));
  return new Blob([renderTabToSvg(tab, { ...opts, fontCss })], { type: 'image/svg+xml' });
}

// ---------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------

export async function exportTabAsPng(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  const canvas = await renderTabToCanvas(tab, opts);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}

// The download helper lives on its own (the Sheet's CSV uses it without the export code).
export { downloadBlob } from '@liveworkspace/workbench/lib/download-blob';
