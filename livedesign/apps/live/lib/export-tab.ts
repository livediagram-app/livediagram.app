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

import { photoImageKey } from './export-tab-images';
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
} from '@livedesign/design';
// Shared SVG render helpers (docs/specs/015-api/mcp-server.md §5): moved into the design package so the
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
} from '@livedesign/design';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { EXPORT_PAPER, pageExportFrame } from './export-page';
import {
  pageScreenRect,
  tabWireframeFrameTheme,
  tagColoursOf,
  withinPageFrame,
} from '@livedesign/design';
import { exportChartInk } from './export-chart-ink';
import { motionFrameHref } from './page-motion-canvas';

// Re-export so callers (the export dialog) get the loader from the same
// `@/lib/export-tab` barrel they already import the exporters from.
export { loadTabImages } from './export-tab-images';

// Webfont embedding for downloads (docs/specs/004-interface-design/fonts.md) — the bytes travel with the file.
import { embeddedFontFaceCss } from './export-fonts';
import { expandForExport } from './component-registry';
import { backgroundPatternDefs, type ImageExportOpts } from './export-tab-parts';
import { renderTabToCanvas } from './export-tab-canvas';
export { renderedExportScale, renderTabToCanvas } from './export-tab-canvas';
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
  // A wireframe page's screen (pageExportFrame lays it inside the screen's clip).
  const r = pageScreenRect(page);
  const href = motionFrameHref(fill, r.width, r.height);
  if (!href) return '';
  return `<image x="${r2(r.x)}" y="${r2(r.y)}" width="${r2(r.width)}" height="${r2(r.height)}" preserveAspectRatio="none" href="${href}"/>`;
}

export function renderTabToSvg(source: Tab, opts: ImageExportOpts = {}): string {
  // Each instance drawn as its main's elements (docs/specs/009-elements/components.md "How an instance draws").
  const tab = expandForExport(source);
  // Same hidden-layer + band-order + band-opacity rules as the canvas
  // renderer above; each band wraps in a <g opacity> when dimmed.
  const frame = opts.page
    ? pageExportFrame(opts.page, {
        transparentPaper: opts.transparentPaper,
        imageHref: (id) => opts.images?.get(id)?.href,
        frameTheme: tabWireframeFrameTheme(tab),
        // A photo page draws its photo's preview (loadTabImages).
        photoHref: (pageId) => opts.images?.get(photoImageKey(pageId))?.href,
        overFill: opts.stillBackground ? undefined : pageMotionSvg(opts.page),
      })
    : null;
  const chartInk = exportChartInk(tab, opts.page);
  // A card's tag colour (docs/specs/009-elements/tag-colours.md): the canvas, exports and thumbnails agree.
  const tagColours = tagColoursOf(tab);
  const reaches = (el: Element) => !frame || frame.reaches(el, tab.elements);
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
  const bounds = frame ? frame.bounds : contentBounds(els, labels, tab.elements);
  const pad = frame ? 0 : (opts.padding ?? EXPORT_PADDING);
  const draw = bounds;
  const vbX = draw.x - pad;
  const vbY = draw.y - pad;
  const vbW = draw.w + pad * 2;
  const vbH = draw.h + pad * 2;
  const bgColor = tab.backgroundColor ?? EXPORT_BG;
  // See the PNG path: unpainted elements take the exported paper's ink.
  const surface = frame ? frame.surface : (opts.surface ?? canvasSurface(bgColor));
  // As the PNG path: a hollow head takes this paper, and an arrow breaks only
  // behind the boxes this export draws (`els`), never a hidden or off-page one.
  const paper = frame ? EXPORT_PAPER : bgColor;
  const parts: string[] = [];
  // An SVG's scale is its size: the drawing (its viewBox) stays as it is.
  const size = opts.scale ?? 1;
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW * size)}" height="${r2(vbH * size)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
  );
  if (frame) {
    if (!opts.elementsOnly) parts.push(frame.backgroundSvg);
  } else if (!opts.transparent)
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
  const bg = frame ? null : backgroundPatternDefs(tab, opts);
  if (bg) {
    parts.push(bg.defs);
    parts.push(
      `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${bg.fill}"/>`,
    );
  }
  // Within each band: every element in array order, arrows interleaved with boxes (same z-order as
  // the canvas and the PNG / PDF); bands stack bottom -> top with frame sections behind their
  // band-mates (docs/specs/006-design/layers.md "Exports stack like the canvas").
  const resolveImageHref = opts.images ? (id: string) => opts.images!.get(id)?.href : undefined;
  // A wireframe page's elements are cut to its screen, its system bars over them (withinPageFrame).
  const bandsStart = parts.length;
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
            tagColours,
            ...chartInk,
            resolveTabWindow: opts.resolveTabWindow,
          }),
        );
      else
        inner.push(
          svgArrow(el, tab.elements, surface, tab.font, labels, undefined, els, paper, tab.finish),
        );
    }
    parts.push(wrapBand(layerOpacityOf(band.layer), inner));
  }
  if (frame?.clipId)
    parts.splice(
      bandsStart,
      parts.length - bandsStart,
      withinPageFrame(frame, parts.slice(bandsStart).join('\n')),
    );
  parts.push('</svg>');
  return parts.join('\n');
}

// A downloaded SVG carries its own typefaces: the reader hasn't got
// Shantell Sans installed, and an @import is dead in an offline viewer.
export async function exportTabAsSvg(source: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  // Expanded first so the faces an instance's words write in are embedded too.
  const tab = expandForExport(source);
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

// The download helper lives on its own, so a caller can save a file without the export code.
export { downloadBlob } from '@liveworkspace/workbench/lib/download-blob';
