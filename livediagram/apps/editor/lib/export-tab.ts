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
  arrowLabelFontStack,
  arrowLabelPass,
  layerBands,
  layerOpacityOf,
  shade,
  exportFontIds,
  visibleLayerElements,
  type BoxedElement,
  type Tab,
} from '@livediagram/document';
// Shared SVG render helpers (docs/specs/015-api/mcp-server.md §5): moved into the document package so the
// MCP worker reuses the same element drawing. The canvas / isometric / backdrop
// orchestration below stays here and imports the per-element drawers + helpers.
import {
  canvasSurface,
  type CanvasSurface,
  contentBounds,
  describeBoxedExport,
  EXPORT_BG,
  EXPORT_IMAGE_STROKE,
  EXPORT_PADDING,
  r2,
  svgArrow,
  sketchBackdropIds,
  svgBoxed,
  svgFontDefs,
  svgShadowDefs,
  xmlEscape,
  type ExportShape,
} from '@livediagram/document';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import {
  isoCanvasMatrix,
  isoDepthLayers,
  isoExtrudes,
  isoLayerBrightness,
  isoProjectBounds,
  ISO_TILT_DEG,
} from './isometric';
// Webfont embedding for downloads (docs/specs/004-interface-design/fonts.md): the bytes travel with the file.
import { embeddedFontFaceCss } from './export-fonts';
import { exportChartInk } from './export-chart-ink';
import { renderTabToCanvas } from './export-tab-canvas';
import { backgroundPatternDefs, type ImageExportOpts } from './export-tab-parts';

export { renderedExportScale, renderTabToCanvas } from './export-tab-canvas';
export { EXPORT_PATTERN_COLOR, type ImageExportOpts } from './export-tab-parts';

// Re-export so callers (the export dialog) get the loader from the same
// `@/lib/export-tab` barrel they already import the exporters from.
export { loadTabImages } from './export-tab-images';

// ---------------------------------------------------------------------
// PNG / PDF helpers — shared canvas rendering
// ---------------------------------------------------------------------

// The largest canvas side and area every browser draws, and the scale that keeps an export inside both (an
// iOS Safari canvas past 16.7 MP comes out blank, however short its sides): one helper for every product.
export {
  exportScale,
  MAX_EXPORT_CANVAS_AREA,
  MAX_EXPORT_CANVAS_SIDE,
} from '@liveworkspace/model-core/export-canvas';

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
  const chartInk = exportChartInk(tab);
  const els = opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers);
  const bands = layerBands(tab.elements, tab.layers, { includeHidden: opts.hiddenLayers });
  // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
  const backdrops = sketchBackdropIds(els, tab.finish);
  const labels = arrowLabelPass(tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font, tab.finish),
  });
  const wrapBand = (layerOpacity: number, inner: string[]): string =>
    layerOpacity < 1
      ? `<g opacity="${r2(layerOpacity)}">${inner.join('\n')}</g>`
      : inner.join('\n');
  const bounds = contentBounds(els, labels, tab.elements);
  const pad = EXPORT_PADDING;
  // Isometric export: the viewBox spans the projected (tilted) footprint and a
  // <g matrix> applies the iso projection to the content, while the background
  // rect stays in viewBox space so it fills the whole frame.
  const iso = opts.isometric ? isoCanvasMatrix() : null;
  const draw = iso ? isoProjectBounds(bounds, iso) : bounds;
  const vbX = draw.x - pad;
  const vbY = draw.y - pad;
  const vbW = draw.w + pad * 2;
  const vbH = draw.h + pad * 2;
  const bgColor = tab.backgroundColor ?? EXPORT_BG;
  // See the PNG path: unpainted elements take the exported paper's ink.
  const surface = canvasSurface(bgColor);
  // As the PNG path: a hollow head takes this paper, and an arrow breaks only
  // behind the boxes this export draws (`els`), never a hidden one.
  const paper = bgColor;
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
  // Backdrop pattern (docs/specs/010-palette/style-presets.md) over the colour, flat (never tilted — the
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
          svgBoxed(el, {
            resolveImageHref,
            resolveIconArt: resolveIconArtLoaded,
            resolveStickerArt: resolveStickerArtLoaded,
            tabFont: tab.font,
            tabFinish: tab.finish,
            sketchBackdrop: backdrops.has(el.id),
            surface,
            ...chartInk,
          }),
        );
    }
    for (const el of band.elements) {
      if (el.type === 'arrow')
        inner.push(
          svgArrow(el, tab.elements, surface, tab.font, labels, undefined, els, paper, tab.finish),
        );
    }
    parts.push(wrapBand(layerOpacityOf(band.layer), inner));
  }
  if (iso) parts.push('</g>');
  parts.push('</svg>');
  return parts.join('\n');
}

// A downloaded SVG carries its own typefaces: the reader hasn't got
// Shantell Sans installed, and an @import is dead in an offline viewer.
export async function exportTabAsSvg(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  const els = opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers);
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
