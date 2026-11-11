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

import { ensureMapGeometryFor } from './map-geometry-loader';
import {
  arrowLabelFontStack,
  arrowLabelPass,
  layerBands,
  layerOpacityOf,
  exportFontIds,
  visibleLayerElements,
  type Element,
  type LaidOutPage,
  type Tab,
} from '@livedocuments/document';
// Shared SVG render helpers (docs/specs/015-api/mcp-server.md §5): moved into the document package so the
// MCP worker reuses the same element drawing. The canvas / backdrop
// orchestration below stays here and imports the per-element drawers + helpers.
import {
  canvasSurface,
  contentBounds,
  EXPORT_BG,
  EXPORT_PADDING,
  r2,
  svgArrow,
  sketchBackdropIds,
  svgBoxed,
  svgFontDefs,
  svgShadowDefs,
  xmlEscape,
} from '@livedocuments/document';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { EXPORT_PAPER, pageExportFrame } from './export-page';
import { exportChartInk } from './export-chart-ink';
import { motionFrameHref } from './page-motion-canvas';

// Re-export so callers (the export dialog) get the loader from the same
// `@/lib/export-tab` barrel they already import the exporters from.
export { loadTabImages } from './export-tab-images';

// Webfont embedding for downloads (docs/specs/004-interface-design/fonts.md) — the bytes travel with the file.
import { embeddedFontFaceCss } from './export-fonts';
import { pageRulingOf, pageWriting, pageWritingFonts } from './article/article-export';
import { articleOpsToSvg } from './article/article-draw';
import {
  exportZoneClips,
  svgZoneClipped,
  isArticleNoteMarker,
  withWritingFonts,
  backgroundPatternDefs,
  type ImageExportOpts,
} from './export-tab-parts';
import { renderTabToCanvas } from './export-tab-canvas';
export { renderedExportScale, renderTabToCanvas, type CanvasRenderOpts } from './export-tab-canvas';
export { EXPORT_PATTERN_COLOR, type ImageExportOpts } from './export-tab-parts';

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

// Exported so the export dialog can render a live preview of the image
// export (docs/specs/010-palette/style-presets.md): same SVG the .svg download produces, and PNG / PDF
// rasterise the same content, so one SVG preview faithfully represents all
// three image formats under the current pattern option.
// A slide's animated background in the SVG export: a picture of its gradient with the motion as
// it stands when the slide opens, as the PNG and PDF paint it (docs/specs/007-editor/
// pages-mode.md "Animated backgrounds"). Nothing where no canvas can draw it, leaving the
// gradient.
function pageMotionSvg(page: LaidOutPage | undefined): string {
  const fill = page?.background?.fill;
  if (!page || fill?.kind !== 'gradient' || !fill.motion) return '';
  const r = page.rect;
  const href = motionFrameHref(fill, r.width, r.height);
  if (!href) return '';
  return `<image x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(r.width)}" height="${r2(r.height)}" preserveAspectRatio="none" href="${href}"/>`;
}

export function renderTabToSvg(tab: Tab, opts: ImageExportOpts = {}): string {
  // Same hidden-layer + band-order + band-opacity rules as the canvas
  // renderer above; each band wraps in a <g opacity> when dimmed.
  const frame = opts.page
    ? pageExportFrame(opts.page, {
        ruling: pageRulingOf(tab, opts.page),
        imageHref: (id) => opts.images?.get(id)?.href,
        overFill: opts.stillBackground ? undefined : pageMotionSvg(opts.page),
      })
    : null;
  const writing = opts.page ? pageWriting(tab, opts.page) : null;
  const estimated =
    !writing && opts.page && opts.estimatedWriting ? opts.estimatedWriting(opts.page) : undefined;
  const clips = exportZoneClips(tab, opts.page);
  const chartInk = exportChartInk(tab, opts.page);
  const reaches = (el: Element) =>
    !isArticleNoteMarker(el) && (!frame || frame.reaches(el, tab.elements));
  const els = (
    opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers)
  ).filter(reaches);
  const bands = layerBands(tab.elements, tab.layers, { includeHidden: opts.hiddenLayers }).map(
    (band) => ({ ...band, elements: band.elements.filter(reaches) }),
  );
  // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
  const backdrops = sketchBackdropIds(els, tab.finish);
  const labels = arrowLabelPass(tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font, tab.finish),
  });
  const wrapBand = (layerOpacity: number, inner: string[]): string =>
    layerOpacity < 1
      ? `<g opacity="${r2(layerOpacity)}">${inner.join('\n')}</g>`
      : inner.join('\n');
  const bounds = frame ? frame.bounds : contentBounds(els, labels);
  const pad = frame ? 0 : EXPORT_PADDING;
  const draw = bounds;
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
    : svgFontDefs(
        withWritingFonts(
          exportFontIds(els, tab.font, tab.finish),
          writing ?? (estimated && opts.page ? { fonts: pageWritingFonts(tab, opts.page) } : null),
        ),
      );
  if (fontDefs) parts.push(fontDefs);
  // The writing, over the page and under every element.
  if (writing) parts.push(articleOpsToSvg(writing.ops));
  else if (estimated) parts.push(estimated);
  // Element-shadow filter defs (docs/specs/008-canvas/element-shadows.md); empty string when none.
  const shadowDefs = svgShadowDefs(els);
  if (shadowDefs) parts.push(shadowDefs);
  // Backdrop pattern (docs/specs/010-palette/style-presets.md) over the colour.
  const bg = frame ? null : backgroundPatternDefs(tab, opts);
  if (bg) {
    parts.push(bg.defs);
    parts.push(
      `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${bg.fill}"/>`,
    );
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
              tabFinish: tab.finish,
              sketchBackdrop: backdrops.has(el.id),
              surface,
              ...chartInk,
              resolveTabWindow: opts.resolveTabWindow,
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
            svgArrow(
              el,
              tab.elements,
              surface,
              tab.font,
              labels,
              undefined,
              els,
              paper,
              tab.finish,
            ),
            clips,
          ),
        );
    }
    parts.push(wrapBand(layerOpacityOf(band.layer), inner));
  }
  parts.push('</svg>');
  return parts.join('\n');
}

// A downloaded SVG carries its own typefaces: the reader hasn't got
// Shantell Sans installed, and an @import is dead in an offline viewer.
export async function exportTabAsSvg(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  await ensureMapGeometryFor(tab.elements);
  const els = opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers);
  // The writing's faces only: the writing itself is measured once, by renderTabToSvg.
  const writing = opts.page ? { fonts: pageWritingFonts(tab, opts.page) } : null;
  const fontCss =
    opts.fontCss ??
    (await embeddedFontFaceCss(
      withWritingFonts(exportFontIds(els, tab.font, tab.finish), writing),
    ));
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

// The download helper lives on its own, so a caller can save a file without the export code.
export { downloadBlob } from '@liveworkspace/workbench/lib/download-blob';
