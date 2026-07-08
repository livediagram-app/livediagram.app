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
  layerBands,
  layerOpacityOf,
  shade,
  visibleLayerElements,
  type BoxedElement,
  type Tab,
} from '@livediagram/diagram';
// Shared SVG render helpers (spec/62 §5): moved into the diagram package so the
// MCP worker reuses the same element drawing. The canvas / isometric / backdrop
// orchestration below stays here and imports the per-element drawers + helpers.
import {
  boxedNeedsSvgRaster,
  contentBounds,
  describeBoxedExport,
  EXPORT_BG,
  EXPORT_IMAGE_STROKE,
  EXPORT_PADDING,
  r2,
  svgArrow,
  svgBoxed,
  xmlEscape,
  type ExportShape,
} from '@livediagram/diagram';
import { backgroundPatternTile } from './canvas-backgrounds';
import { resolveIconArtLoaded } from './icon-registry';
import {
  isoCanvasMatrix,
  isoDepthLayers,
  isoLayerBrightness,
  isoProjectBounds,
  ISO_TILT_DEG,
} from './isometric';
import { drawArrow, drawBoxed, drawBoxedExtrusion } from './export-tab-canvas-draw';
import type { ExportImageMap } from './export-tab-images';

// Shared options for the image exports (PNG / SVG / PDF). `isometric` tilts
// the rendered scene into the editor's isometric projection (spec/45 / 48),
// off by default. `pattern` paints the tab's backdrop pattern (grid / dots /
// …); on by default, the user can switch it off in the Export dialog.
// `images` carries pre-loaded bitmaps (keyed by imageId) so image / avatar
// elements embed their photo instead of a placeholder; absent ids (or no map)
// fall back to the placeholder. Build it with loadTabImages (export-tab-images).
// `hiddenLayers` INCLUDES layers the user has hidden (spec/74); off by default
// so the export matches what the canvas shows.
export type ImageExportOpts = {
  isometric?: boolean;
  pattern?: boolean;
  hiddenLayers?: boolean;
  images?: ExportImageMap;
};

// Re-export so callers (the export dialog) get the loader from the same
// `@/lib/export-tab` barrel they already import the exporters from.
export { loadTabImages } from './export-tab-images';

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

// JSON snapshot + Markdown outline — the non-visual export formats.
// They share nothing with the rasteriser below beyond the Tab data
// model, so they live in their own module; re-exported here so the
// existing `@/lib/export-tab` import paths keep resolving unchanged.
export {
  TAB_SCHEMA_VERSION,
  exportTabAsJson,
  exportTabAsMarkdown,
  tabToJsonText,
  tabToMarkdownText,
  type ExportedTabEnvelope,
} from './export-tab-text';

// ---------------------------------------------------------------------
// PNG / PDF helpers — shared canvas rendering
// ---------------------------------------------------------------------

export async function renderTabToCanvas(
  tab: Tab,
  opts: { scale?: number } & ImageExportOpts = {},
): Promise<HTMLCanvasElement> {
  const scale = opts.scale ?? 2; // default 2× for crisp output
  // Hidden layers drop out of the export (bounds included) unless the
  // dialog's include-hidden option is on (spec/74). `ordered` is the
  // paint order — layer bands bottom -> top, frames first per band —
  // with each element carrying its band's opacity factor.
  const els = opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers);
  const ordered = layerBands(tab.elements, tab.layers, {
    includeHidden: opts.hiddenLayers,
  }).flatMap((band) => band.elements.map((el) => ({ el, alpha: layerOpacityOf(band.layer) })));
  const bounds = contentBounds(els);
  // Isometric export (spec/45 / 48): project the flat content through the iso
  // affine and size the canvas to the tilted footprint so nothing clips. The
  // matrix is applied to the drawing context after positioning, so every
  // element / arrow drawer stays in plain canvas coordinates.
  const iso = opts.isometric ? isoCanvasMatrix() : null;
  const draw = iso ? isoProjectBounds(bounds, iso) : bounds;
  const w = (draw.w + EXPORT_PADDING * 2) * scale;
  const h = (draw.h + EXPORT_PADDING * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(w));
  canvas.height = Math.max(1, Math.floor(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  // Background colour, painted across the whole canvas BEFORE the iso tilt so
  // the triangular margins around the parallelogram fill too. The pattern (if
  // on) sits flat over it — like the editor, whose backdrop never tilts.
  ctx.fillStyle = tab.backgroundColor ?? EXPORT_BG;
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
  // Position the (projected) content min-corner at the padding offset, then
  // apply the iso projection so element coords map onto the tilted plane.
  ctx.translate(EXPORT_PADDING - draw.x, EXPORT_PADDING - draw.y);
  if (iso) ctx.transform(iso.a, iso.b, iso.c, iso.d, 0, 0);

  // Isometric: paint every element's extrusion column first, so all the
  // depth sits behind all the element bodies (matching the editor's single
  // depth plane behind the element layer).
  if (iso) {
    for (const { el, alpha } of ordered) {
      if (el.type !== 'arrow') drawBoxedExtrusion(ctx, el, alpha);
    }
  }
  // Boxed elements first so arrows draw over them with the right
  // z-order on either end; framesFirst keeps frame sections behind
  // their contents (spec/09).
  const resolveImage = opts.images ? (id: string) => opts.images!.get(id)?.image : undefined;
  // Elements the canvas drawers can't reproduce (tables, freehand, shape
  // silhouettes, rotation, icon glyphs — boxedNeedsSvgRaster) rasterise via
  // the SAME svg markup the SVG export emits, so the PNG/PDF output can't
  // drift from it. Pre-rendered async here (the draw loop below stays
  // sync), padded for stroke overflow — and for the rotated bounding box
  // when the element carries a rotation, since svgBoxed bakes the rotation
  // into the markup and it sweeps outside the unrotated box. A failed
  // rasterise falls back to drawBoxed's plain box.
  const rasterImages = new Map<string, { image: HTMLImageElement; pad: number }>();
  for (const el of els) {
    if (el.type === 'arrow' || !isBoxed(el)) continue;
    if (!boxedNeedsSvgRaster(el, resolveIconArtLoaded)) continue;
    const diag = Math.hypot(el.width, el.height);
    const pad = el.rotation ? (diag - Math.min(el.width, el.height)) / 2 + 2 : 2;
    const w = el.width + pad * 2;
    const h = el.height + pad * 2;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(w * scale)}" height="${r2(h * scale)}"` +
      ` viewBox="${r2(el.x - pad)} ${r2(el.y - pad)} ${r2(w)} ${r2(h)}">` +
      `${svgBoxed(el, undefined, resolveIconArtLoaded)}</svg>`;
    try {
      rasterImages.set(el.id, { image: await svgToImage(svg), pad });
    } catch {
      // Fall through to drawBoxed's plain box below.
    }
  }
  for (const { el, alpha } of ordered) {
    if (el.type === 'arrow') continue;
    const raster = rasterImages.get(el.id);
    if (raster) {
      // The raster bakes the ELEMENT's opacity into its markup; the
      // band's factor applies here.
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        raster.image,
        el.x - raster.pad,
        el.y - raster.pad,
        el.width + raster.pad * 2,
        el.height + raster.pad * 2,
      );
      ctx.globalAlpha = 1;
      continue;
    }
    drawBoxed(ctx, el, resolveImage, alpha);
  }
  for (const { el, alpha } of ordered) {
    if (el.type !== 'arrow') continue;
    // Endpoint resolution keeps the FULL list, so an arrow pinned to a
    // hidden element still lands where the canvas draws it.
    drawArrow(ctx, el, tab.elements, alpha);
  }
  return canvas;
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

// Isometric extrusion column for one boxed element (spec/45) — the SVG
// counterpart of drawBoxedExtrusion. Stepped silhouette copies, dimmed toward
// the floor, behind the element body.
function svgBoxedExtrusion(el: BoxedElement): string {
  const { shape, opacity } = describeBoxedExport(el);
  if (shape.kind === 'none') return '';
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
// export (spec/48): same SVG the .svg download produces, and PNG / PDF
// rasterise the same content, so one SVG preview faithfully represents all
// three image formats under the current isometric / pattern options.
export function renderTabToSvg(tab: Tab, opts: ImageExportOpts = {}): string {
  // Same hidden-layer + band-order + band-opacity rules as the canvas
  // renderer above; each band wraps in a <g opacity> when dimmed.
  const els = opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers);
  const bands = layerBands(tab.elements, tab.layers, { includeHidden: opts.hiddenLayers });
  const wrapBand = (layerOpacity: number, inner: string[]): string =>
    layerOpacity < 1
      ? `<g opacity="${r2(layerOpacity)}">${inner.join('\n')}</g>`
      : inner.join('\n');
  const bounds = contentBounds(els);
  // Isometric export: the viewBox spans the projected (tilted) footprint and a
  // <g matrix> applies the iso projection to the content, while the background
  // rect stays in viewBox space so it fills the whole frame.
  const iso = opts.isometric ? isoCanvasMatrix() : null;
  const draw = iso ? isoProjectBounds(bounds, iso) : bounds;
  const vbX = draw.x - EXPORT_PADDING;
  const vbY = draw.y - EXPORT_PADDING;
  const vbW = draw.w + EXPORT_PADDING * 2;
  const vbH = draw.h + EXPORT_PADDING * 2;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW)}" height="${r2(vbH)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
  );
  parts.push(
    `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${xmlEscape(tab.backgroundColor ?? EXPORT_BG)}"/>`,
  );
  // Backdrop pattern (spec/48) over the colour, flat (never tilted — the
  // editor's backdrop doesn't tilt in isometric either).
  const bg = backgroundPatternDefs(tab, opts);
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
          band.elements.filter((el) => el.type !== 'arrow').map((el) => svgBoxedExtrusion(el)),
        ),
      );
    }
  }
  // Within each band: boxed elements first, then arrows on top (same
  // z-order as the canvas); bands stack bottom -> top with frame
  // sections behind their band-mates (spec/74 + spec/09).
  const resolveImageHref = opts.images ? (id: string) => opts.images!.get(id)?.href : undefined;
  for (const band of bands) {
    const inner: string[] = [];
    for (const el of band.elements) {
      if (el.type !== 'arrow') inner.push(svgBoxed(el, resolveImageHref, resolveIconArtLoaded));
    }
    for (const el of band.elements) {
      if (el.type === 'arrow') inner.push(svgArrow(el, tab.elements));
    }
    parts.push(wrapBand(layerOpacityOf(band.layer), inner));
  }
  if (iso) parts.push('</g>');
  parts.push('</svg>');
  return parts.join('\n');
}

export function exportTabAsSvg(tab: Tab, opts: ImageExportOpts = {}): Blob {
  return new Blob([renderTabToSvg(tab, opts)], { type: 'image/svg+xml' });
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

// ---------------------------------------------------------------------
// Download helper — trigger a browser save dialog for the produced
// blob. Lives here so call sites don't repeat the same anchor-element
// dance every time.
// ---------------------------------------------------------------------

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before revoking
  // the URL — revoking too early aborts the save in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
