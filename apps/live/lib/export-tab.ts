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

import type { Item, ItemTypeDef } from '@livediagram/items';
import {
  arrowLabelFontStack,
  arrowLabelPass,
  articlesOf,
  drawingZoneClips,
  illustratePagesOf,
  isBoxed,
  isDrawingElement,
  layOutIllustratePages,
  layerBands,
  layerOpacityOf,
  shade,
  exportFontIds,
  visibleLayerElements,
  type BoxedElement,
  type Element,
  type LaidOutPage,
  type PageRect,
  type Tab,
} from '@livediagram/document';
// Shared SVG render helpers (docs/specs/015-api/mcp-server.md §5): moved into the document package so the
// MCP worker reuses the same element drawing. The canvas / isometric / backdrop
// orchestration below stays here and imports the per-element drawers + helpers.
import {
  canvasSurface,
  type CanvasSurface,
  boxedNeedsSvgRaster,
  contentBounds,
  describeBoxedExport,
  EXPORT_BG,
  EXPORT_IMAGE_STROKE,
  EXPORT_PADDING,
  r2,
  supportsShadow,
  svgArrow,
  svgBoxed,
  svgFontDefs,
  svgShadowDefs,
  xmlEscape,
  type ExportShape,
} from '@livediagram/document';
import { backgroundPatternTile } from './canvas-backgrounds';
import { resolveIconArtLoaded, resolveStickerArtLoaded } from './icon-registry';
import {
  isoCanvasMatrix,
  isoDepthLayers,
  isoExtrudes,
  isoLayerBrightness,
  isoProjectBounds,
  ISO_TILT_DEG,
} from './isometric';
import { drawBoxed, drawBoxedExtrusion } from './export-tab-canvas-draw';
import { EXPORT_PAPER, pageExportFrame } from './export-page';
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
  // One Illustrate page to export (docs/specs/007-editor/illustrate-pages.md "Export"): the
  // frame becomes exactly its sheet, painted with its background; isometric and the tab's own
  // backdrop do not apply.
  page?: LaidOutPage;
  // A logo page's plain paper left see-through (docs/specs/007-editor/logo-pages.md "Export"):
  // PNG and SVG pass it, PDF never does.
  transparentPaper?: boolean;
  // The document's items, so Plan boards and cards export with their cards
  // (docs/specs/026-plan/plan-board.md "Both elements everywhere").
  items?: ReadonlyMap<string, Item>;
  // And its item types (docs/specs/026-plan/item-types.md), so custom types keep their colour.
  itemTypes?: readonly ItemTypeDef[];
};

// Re-export so callers (the export dialog) get the loader from the same
// `@/lib/export-tab` barrel they already import the exporters from.
export { loadTabImages } from './export-tab-images';

// Webfont embedding for downloads (docs/specs/004-interface-design/fonts.md) — the bytes travel with the file.
import { embeddedFontFaceCss } from './export-fonts';
import {
  pageRulingOf,
  pageWriting,
  pageWritingFonts,
  type PageWriting,
} from './article/article-export';
import { articleOpsToSvg, drawArticleOps } from './article/article-draw';

// A page export's drawing-zone clips (docs/specs/007-editor/article-pages.md "Zones"): what pokes
// past a drawing zone's edge is cut off in an export as on the canvas.
function exportZoneClips(tab: Tab, page: LaidOutPage | undefined): Map<string, PageRect> {
  if (!page) return new Map();
  return drawingZoneClips(
    layOutIllustratePages(illustratePagesOf(tab)),
    articlesOf(tab),
    tab.elements,
    isDrawingElement,
  );
}

// An element's SVG markup cut off at its drawing zone, when it has one.
function svgZoneClipped(id: string, svg: string, clips: Map<string, PageRect>): string {
  const r = clips.get(id);
  if (!r || !svg) return svg;
  const cid = `lvd-zc-${id}`.replace(/[^a-zA-Z0-9-]/g, '');
  return `<clipPath id="${cid}"><rect x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(r.width)}" height="${r2(r.height)}"/></clipPath><g clip-path="url(#${cid})">${svg}</g>`;
}

// An article's margin-note marker (docs/specs/007-editor/article-pages.md "Comments and actions"):
// review furniture, like a comment badge, never part of what the page prints.
const isArticleNoteMarker = (el: Element) => el.type === 'annotation' && !!el.articleNote;

// The font ids an export declares, with an article page's writing's faces added.
function withWritingFonts(ids: string[], writing: Pick<PageWriting, 'fonts'> | null): string[] {
  return writing ? [...new Set([...ids, ...writing.fonts])] : ids;
}

// Default backdrop pattern colour when a tab leaves it unset (matches the
// editor's fallback).
const EXPORT_PATTERN_COLOR = '#cbd5e1'; // slate-300

// One <pattern> id for the export SVG / canvas rasterisation.
const BG_PATTERN_ID = 'lvd-export-bg';

// The tab's backdrop pattern as an SVG <defs> + a fill ref, or null when the
// pattern is off / blank / unset. Shared by the SVG export (inline) and the
// PNG/PDF rasteriser. Animated patterns + Blank return null (no static image).
function backgroundPatternDefs(
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
  const frame = opts.page
    ? pageExportFrame(opts.page, {
        ruling: pageRulingOf(tab, opts.page),
        transparentPaper: opts.transparentPaper,
      })
    : null;
  // An article page's writing (docs/specs/007-editor/article-pages.md "Everywhere a page goes").
  const writing = opts.page ? pageWriting(tab, opts.page) : null;
  const clips = exportZoneClips(tab, opts.page);
  const reaches = (el: Element) =>
    !isArticleNoteMarker(el) && (!frame || frame.reaches(el, tab.elements));
  // Hidden layers drop out of the export (bounds included) unless the
  // dialog's include-hidden option is on (docs/specs/006-document/layers.md). `ordered` is the
  // paint order — layer bands bottom -> top, frames first per band —
  // with each element carrying its band's opacity factor.
  const els = (
    opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers)
  ).filter(reaches);
  const ordered = layerBands(tab.elements, tab.layers, {
    includeHidden: opts.hiddenLayers,
  }).flatMap((band) =>
    band.elements.filter(reaches).map((el) => ({ el, alpha: layerOpacityOf(band.layer) })),
  );
  // Every caption laid out once, as the canvas and the SVG export do
  // (docs/specs/008-canvas/arrow-labels.md); the bounds include the plates.
  const labels = arrowLabelPass(tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font),
  });
  const bounds = frame ? frame.bounds : contentBounds(els, labels);
  const pad = frame ? 0 : EXPORT_PADDING;
  // Isometric export (docs/specs/008-canvas/isometric-view.md / 48): project the flat content through the iso
  // affine and size the canvas to the tilted footprint so nothing clips. The
  // matrix is applied to the drawing context after positioning, so every
  // element / arrow drawer stays in plain canvas coordinates.
  const iso = opts.isometric && !frame ? isoCanvasMatrix() : null;
  const draw = iso ? isoProjectBounds(bounds, iso) : bounds;
  // 2x for crisp output, lowered so no side passes the largest canvas every browser draws (a Fit to
  // Content page reaches 19200 px, docs/specs/007-editor/illustrate-pages.md "Sizes").
  const scale = exportScale(opts.scale ?? 2, draw.w + pad * 2, draw.h + pad * 2);
  const w = (draw.w + pad * 2) * scale;
  const h = (draw.h + pad * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(w));
  canvas.height = Math.max(1, Math.floor(h));
  renderedScale.set(canvas, scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  // Background colour, painted across the whole canvas BEFORE the iso tilt so
  // the triangular margins around the parallelogram fill too. The pattern (if
  // on) sits flat over it — like the editor, whose backdrop never tilts.
  const bgColor = tab.backgroundColor ?? EXPORT_BG;
  // Elements that carry no colours of their own are drawn in the ink of the
  // paper being exported onto (docs/specs/007-editor/live-app.md), so a dark canvas exports dark-canvas
  // elements rather than pale ones.
  const surface = frame ? frame.surface : canvasSurface(bgColor);
  // The paper under the content: a hollow arrowhead is filled with it, as on the canvas.
  const paper = frame ? EXPORT_PAPER : bgColor;
  ctx.fillStyle = paper;
  if (!frame?.transparent) ctx.fillRect(0, 0, w / scale, h / scale);
  const bg = frame ? null : backgroundPatternDefs(tab, opts);
  if (frame) {
    const { x, y, w: fw, h: fh } = frame.bounds;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.floor(w)}" height="${Math.floor(h)}" viewBox="${r2(x)} ${r2(y)} ${r2(fw)} ${r2(fh)}">` +
      `${frame.backgroundSvg}</svg>`;
    try {
      ctx.drawImage(await svgToImage(svg), 0, 0, w / scale, h / scale);
    } catch {
      // The paper behind it is already down: a failed paint must never abort the export.
    }
  }
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
  // Position the (projected) content min-corner at the padding offset, then
  // apply the iso projection so element coords map onto the tilted plane.
  ctx.translate(pad - draw.x, pad - draw.y);
  if (iso) ctx.transform(iso.a, iso.b, iso.c, iso.d, 0, 0);
  // The writing, over the page and under every element (its zones' elements sit over it).
  if (writing) {
    await document.fonts?.ready;
    drawArticleOps(ctx, writing.ops);
  }

  // Isometric: paint every element's extrusion column first, so all the
  // depth sits behind all the element bodies (matching the editor's single
  // depth plane behind the element layer).
  if (iso) {
    for (const { el, alpha } of ordered) {
      if (el.type !== 'arrow') drawBoxedExtrusion(ctx, el, alpha, surface);
    }
  }
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
  const fontCss = opts.fontCss ?? (await embeddedFontFaceCss(exportFontIds(els, tab.font)));
  // The canvas drawers paint through the DOM's own font set, so wait for it
  // to settle — rasterising mid-swap bakes the fallback face into the PNG.
  await document.fonts?.ready;
  const fontDefs = fontCss ? `<defs><style type="text/css">${fontCss}</style></defs>` : '';
  const rasterImages = new Map<string, { image: HTMLImageElement; pad: number }>();
  for (const el of els) {
    if (el.type === 'arrow' || !isBoxed(el)) continue;
    if (!boxedNeedsSvgRaster(el, resolveIconArtLoaded, resolveStickerArtLoaded)) continue;
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
        tabFont,
        surface,
        items: opts.items,
        itemTypes: opts.itemTypes,
      })}</svg>`;
    try {
      rasterImages.set(el.id, { image: await svgToImage(svg), pad });
    } catch {
      // Fall through to drawBoxed's plain box below.
    }
  }
  // One pass in the canvas's paint order (docs/specs/006-document/layers.md): arrows and boxes
  // interleave by array order, so an arrow sent behind a box stays behind it.
  // Arrows rasterise from the SAME markup the SVG export emits (heads, fans,
  // wrapped captions, knockouts, route-behind gaps), batched: each run of
  // consecutive arrows becomes one full-size layer. Endpoint resolution keeps
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
  for (const { el, alpha } of ordered) {
    if (el.type === 'arrow') {
      const svg = svgZoneClipped(
        el.id,
        svgArrow(el, tab.elements, surface, tabFont, labels, undefined, els, paper),
        clips,
      );
      arrowRun.push(alpha < 1 ? `<g opacity="${r2(alpha)}">${svg}</g>` : svg);
      continue;
    }
    await flushArrows();
    // Cut off at its drawing zone, as on the canvas.
    const clip = clips.get(el.id);
    if (clip) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(clip.x, clip.y, clip.width, clip.height);
      ctx.clip();
    }
    drawOne(ctx, el, alpha);
    if (clip) ctx.restore();
  }
  await flushArrows();
  return canvas;

  function drawOne(c: CanvasRenderingContext2D, el: BoxedElement, alpha: number) {
    const raster = rasterImages.get(el.id);
    if (raster) {
      // The raster bakes the ELEMENT's opacity into its markup; the
      // band's factor applies here.
      c.globalAlpha = alpha;
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
    drawBoxed(c, el, resolveImage, alpha, tabFont, surface);
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

// The image-placeholder colours shared by both renderers. Element fill /
// stroke / text fall through to the diagram's defaultFillColor / -Stroke /
// -Text (matching the canvas), so there's no separate "export ink" default.
// Round to 2dp so the markup stays compact without visible drift.
function svgSilhouette(
  el: BoxedElement,
  kind: ExportShape['kind'],
  dx: number,
  dy: number,
  fill: string,
): string {
  const x = el.x + dx;
  const y = el.y + dy;
  const cx = x + el.width / 2;
  const cy = y + el.height / 2;
  if (kind === 'ellipse') {
    return `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(el.width / 2)}" ry="${r2(el.height / 2)}" fill="${xmlEscape(fill)}"/>`;
  }
  if (kind === 'diamond') {
    return `<polygon points="${r2(cx)},${r2(y)} ${r2(x + el.width)},${r2(cy)} ${r2(cx)},${r2(y + el.height)} ${r2(x)},${r2(cy)}" fill="${xmlEscape(fill)}"/>`;
  }
  return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="6" fill="${xmlEscape(fill)}"/>`;
}

// Isometric extrusion column for one boxed element (docs/specs/008-canvas/isometric-view.md) — the SVG
// counterpart of drawBoxedExtrusion. Stepped silhouette copies, dimmed toward
// the floor, behind the element body.
function svgBoxedExtrusion(el: BoxedElement, surface: CanvasSurface): string {
  // Frames / text / icon shapes stay flat (isoExtrudes, shared with the
  // on-screen IsometricDepthLayer + the canvas exporter).
  if (!isoExtrudes(el)) return '';
  const { shape, opacity } = describeBoxedExport(el, { surface });
  if (shape.kind === 'none' || shape.kind === 'sticker') return '';
  const accent = shape.kind === 'image' ? EXPORT_IMAGE_STROKE : shape.stroke;
  const az = (ISO_TILT_DEG.z * Math.PI) / 180;
  const k = Math.tan((ISO_TILT_DEG.x * Math.PI) / 180);
  const ox = Math.sin(az);
  const oy = Math.cos(az);
  const layers = isoDepthLayers();
  const opAttr = opacity !== 1 ? ` opacity="${r2(opacity)}"` : '';
  const parts = [`<g${opAttr}>`];
  for (let i = layers.length - 1; i >= 0; i--) {
    const z = -layers[i]!;
    const fill = shade(accent, 1 - isoLayerBrightness(i, layers.length));
    parts.push(svgSilhouette(el, shape.kind, z * k * ox, z * k * oy, fill));
  }
  parts.push('</g>');
  return parts.join('');
}

// Exported so the export dialog can render a live preview of the image
// export (docs/specs/010-palette/style-presets.md): same SVG the .svg download produces, and PNG / PDF
// rasterise the same content, so one SVG preview faithfully represents all
// three image formats under the current isometric / pattern options.
export function renderTabToSvg(tab: Tab, opts: ImageExportOpts = {}): string {
  // Same hidden-layer + band-order + band-opacity rules as the canvas
  // renderer above; each band wraps in a <g opacity> when dimmed.
  const frame = opts.page
    ? pageExportFrame(opts.page, {
        ruling: pageRulingOf(tab, opts.page),
        transparentPaper: opts.transparentPaper,
      })
    : null;
  const writing = opts.page ? pageWriting(tab, opts.page) : null;
  const clips = exportZoneClips(tab, opts.page);
  const reaches = (el: Element) =>
    !isArticleNoteMarker(el) && (!frame || frame.reaches(el, tab.elements));
  const els = (
    opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers)
  ).filter(reaches);
  const bands = layerBands(tab.elements, tab.layers, { includeHidden: opts.hiddenLayers }).map(
    (band) => ({ ...band, elements: band.elements.filter(reaches) }),
  );
  const labels = arrowLabelPass(tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font),
  });
  const wrapBand = (layerOpacity: number, inner: string[]): string =>
    layerOpacity < 1
      ? `<g opacity="${r2(layerOpacity)}">${inner.join('\n')}</g>`
      : inner.join('\n');
  const bounds = frame ? frame.bounds : contentBounds(els, labels);
  const pad = frame ? 0 : EXPORT_PADDING;
  // Isometric export: the viewBox spans the projected (tilted) footprint and a
  // <g matrix> applies the iso projection to the content, while the background
  // rect stays in viewBox space so it fills the whole frame.
  const iso = opts.isometric && !frame ? isoCanvasMatrix() : null;
  const draw = iso ? isoProjectBounds(bounds, iso) : bounds;
  const vbX = draw.x - pad;
  const vbY = draw.y - pad;
  const vbW = draw.w + pad * 2;
  const vbH = draw.h + pad * 2;
  const bgColor = tab.backgroundColor ?? EXPORT_BG;
  // See the PNG path: unpainted elements take the exported paper's ink.
  const surface = frame ? frame.surface : canvasSurface(bgColor);
  // As the PNG path: a hollow head takes this paper, and an arrow breaks only
  // behind the boxes this export draws (`els`), never a hidden or off-page one.
  const paper = frame ? EXPORT_PAPER : bgColor;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW)}" height="${r2(vbH)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
  );
  parts.push(
    frame
      ? frame.backgroundSvg
      : `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${xmlEscape(bgColor)}"/>`,
  );
  // Typefaces (docs/specs/004-interface-design/fonts.md): the real bytes when the caller pre-fetched them
  // (a download, which must stand alone), else a declaration of the Google
  // stylesheet (the live preview, where the page has the faces already).
  const fontDefs = opts.fontCss
    ? `<defs><style type="text/css">${opts.fontCss}</style></defs>`
    : svgFontDefs(withWritingFonts(exportFontIds(els, tab.font), writing));
  if (fontDefs) parts.push(fontDefs);
  // The writing, over the page and under every element.
  if (writing) parts.push(articleOpsToSvg(writing.ops));
  // Element-shadow filter defs (docs/specs/008-canvas/element-shadows.md); empty string when none.
  const shadowDefs = svgShadowDefs(els);
  if (shadowDefs) parts.push(shadowDefs);
  // Backdrop pattern (docs/specs/010-palette/style-presets.md) over the colour, flat (never tilted — the
  // editor's backdrop doesn't tilt in isometric either).
  const bg = frame ? null : backgroundPatternDefs(tab, opts);
  if (bg) {
    parts.push(bg.defs);
    parts.push(
      `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${bg.fill}"/>`,
    );
  }
  if (iso) {
    parts.push(`<g transform="matrix(${r2(iso.a)} ${r2(iso.b)} ${r2(iso.c)} ${r2(iso.d)} 0 0)">`);
    // All extrusion columns behind all element bodies (matching the canvas).
    for (const band of bands) {
      parts.push(
        wrapBand(
          layerOpacityOf(band.layer),
          band.elements
            .filter((el) => el.type !== 'arrow')
            .map((el) => svgBoxedExtrusion(el, surface)),
        ),
      );
    }
  }
  // Within each band: boxed elements first, then arrows on top (same
  // z-order as the canvas); bands stack bottom -> top with frame
  // sections behind their band-mates (docs/specs/006-document/layers.md + docs/specs/008-canvas/canvas-and-palette.md).
  const resolveImageHref = opts.images ? (id: string) => opts.images!.get(id)?.href : undefined;
  for (const band of bands) {
    const inner: string[] = [];
    for (const el of band.elements) {
      if (el.type !== 'arrow')
        inner.push(
          svgZoneClipped(
            el.id,
            svgBoxed(el, {
              resolveImageHref,
              resolveIconArt: resolveIconArtLoaded,
              resolveStickerArt: resolveStickerArtLoaded,
              tabFont: tab.font,
              surface,
              items: opts.items,
              itemTypes: opts.itemTypes,
            }),
            clips,
          ),
        );
    }
    for (const el of band.elements) {
      if (el.type === 'arrow')
        inner.push(
          svgZoneClipped(
            el.id,
            svgArrow(el, tab.elements, surface, tab.font, labels, undefined, els, paper),
            clips,
          ),
        );
    }
    parts.push(wrapBand(layerOpacityOf(band.layer), inner));
  }
  if (iso) parts.push('</g>');
  parts.push('</svg>');
  return parts.join('\n');
}

// A downloaded SVG carries its own typefaces: the reader hasn't got
// Permanent Marker installed, and an @import is dead in an offline viewer.
export async function exportTabAsSvg(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  const els = opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers);
  // The writing's faces only: the writing itself is measured once, by renderTabToSvg.
  const writing = opts.page ? { fonts: pageWritingFonts(tab, opts.page) } : null;
  const fontCss =
    opts.fontCss ??
    (await embeddedFontFaceCss(withWritingFonts(exportFontIds(els, tab.font), writing)));
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
export { downloadBlob } from './download-blob';
