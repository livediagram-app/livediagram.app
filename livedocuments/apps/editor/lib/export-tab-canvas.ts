// The PNG / PDF path (export-tab.ts): a tab drawn onto a canvas, rasterising through the SVG export's own markup
// what the canvas drawers cannot draw. Split out of export-tab.ts, which re-exports renderTabToCanvas.

import { ensureMapGeometryFor } from './map-geometry-loader';
import {
  arrowLabelFontStack,
  arrowLabelPass,
  isBoxed,
  layerBands,
  layerOpacityOf,
  exportFontIds,
  visibleLayerElements,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livedocuments/document';
import { exportScale, MAX_EXPORT_CANVAS_SIDE } from '@liveworkspace/model-core/export-canvas';
import {
  canvasSurface,
  boxedNeedsSvgRaster,
  contentBounds,
  EXPORT_BG,
  EXPORT_PADDING,
  r2,
  supportsShadow,
  svgArrow,
  sketchBackdropIds,
  svgBoxed,
  svgShadowDefs,
} from '@livedocuments/document';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { drawBoxed } from './export-tab-canvas-draw';
import { EXPORT_PAPER, pageExportFrame } from './export-page';
import { exportChartInk } from './export-chart-ink';
import { paintMotionFrame } from './page-motion-canvas';
import { embeddedFontFaceCss } from './export-fonts';
import { pageRulingOf, pageWriting } from './article/article-export';
import { drawArticleOps } from './article/article-draw';
import {
  exportZoneClips,
  svgZoneClipped,
  isArticleNoteMarker,
  backgroundPatternDefs,
  type ImageExportOpts,
} from './export-tab-parts';

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

// How far past a whole pixel a size may be from float arithmetic alone (1024 x 2.0000000001) and still count as
// that whole pixel when the canvas is sized.
const PART_PIXEL_NOISE = 1e-6;

// The scale each rendered canvas was drawn at, so a caller can size it in CSS
// px (the single-page PDF prints it at 0.75 pt per CSS px, not per pixel).
const renderedScale = new WeakMap<HTMLCanvasElement, number>();

/** The scale `renderTabToCanvas` drew this canvas at (CSS px x scale = pixels); 1 if unknown. */
export function renderedExportScale(canvas: HTMLCanvasElement): number {
  return renderedScale.get(canvas) ?? 1;
}

// What renderTabToCanvas draws beyond the image exports' options: its scale, and for a picture of part of a page
// (docs/specs/020-import-export/blueprints/office-export.md "drawRegion") only some elements, cut to a rect.
export type CanvasRenderOpts = {
  scale?: number;
  // Only these elements, on a transparent canvas: no paper, background, pattern or writing.
  only?: ReadonlySet<string>;
  // The canvas covers exactly this rect (canvas px), with no padding.
  crop?: { x: number; y: number; w: number; h: number };
} & ImageExportOpts;

export async function renderTabToCanvas(
  tab: Tab,
  opts: CanvasRenderOpts = {},
): Promise<HTMLCanvasElement> {
  // A map's land (docs/specs/009-elements/map.md "Exports and other surfaces"), loaded only when the tab has one.
  await ensureMapGeometryFor(tab.elements);
  const frame = opts.page
    ? pageExportFrame(opts.page, {
        ruling: pageRulingOf(tab, opts.page),
        imageHref: (id) => opts.images?.get(id)?.href,
      })
    : null;
  // An article page's writing (docs/specs/007-editor/article-pages.md "Everywhere a page goes"); a picture of some
  // elements has none.
  const only = opts.only;
  const writing = opts.page && !only ? pageWriting(tab, opts.page) : null;
  const clips = exportZoneClips(tab, opts.page);
  const chartInk = exportChartInk(tab, opts.page);
  const reaches = (el: Element) =>
    !isArticleNoteMarker(el) &&
    (!only || only.has(el.id)) &&
    (!frame || frame.reaches(el, tab.elements));
  // Hidden layers drop out of the export (bounds included) unless the
  // dialog's include-hidden option is on (docs/specs/006-document/layers.md). `ordered` is the
  // paint order (layer bands bottom -> top, frames first per band),
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
  // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
  const backdrops = sketchBackdropIds(els, tab.finish);
  const labels = arrowLabelPass(tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font, tab.finish),
  });
  const bounds = opts.crop ?? (frame ? frame.bounds : contentBounds(els, labels));
  const pad = frame || opts.crop ? 0 : EXPORT_PADDING;
  const draw = bounds;
  // 2x for crisp output, lowered so no side passes the largest canvas every browser draws (a Fit to
  // Content page reaches 19200 px, docs/specs/007-editor/pages-mode.md "Sizes").
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
  // Background colour, painted across the whole canvas; the pattern (if on) sits over it.
  const bgColor = tab.backgroundColor ?? EXPORT_BG;
  // Elements that carry no colours of their own are drawn in the ink of the
  // paper being exported onto (docs/specs/007-editor/editor-app.md), so a dark canvas exports dark-canvas
  // elements rather than pale ones.
  const surface = frame ? frame.surface : canvasSurface(bgColor);
  // The paper under the content: a hollow arrowhead is filled with it, as on the canvas.
  const paper = frame ? EXPORT_PAPER : bgColor;
  // A picture of some elements is transparent around them.
  if (!only) {
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w / scale, h / scale);
  }
  const bg = frame || only ? null : backgroundPatternDefs(tab, opts);
  if (frame && !only) {
    const { x, y, w: fw, h: fh } = frame.bounds;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.floor(w)}" height="${Math.floor(h)}" viewBox="${r2(x)} ${r2(y)} ${r2(fw)} ${r2(fh)}">` +
      `${frame.backgroundSvg}</svg>`;
    try {
      ctx.drawImage(await svgToImage(svg), 0, 0, w / scale, h / scale);
    } catch {
      // The paper behind it is already down: a failed paint must never abort the export.
    }
    // A slide's animated background, still as the slide opens, over its gradient and under all on
    // it (docs/specs/007-editor/pages-mode.md "Animated backgrounds").
    const pageFill = opts.page?.background?.fill;
    if (opts.page && pageFill?.kind === 'gradient' && pageFill.motion) {
      const r = opts.page.rect;
      paintMotionFrame(
        ctx,
        pageFill.motion,
        pageFill,
        { x: r.x - x, y: r.y - y, width: r.width, height: r.height },
        opts.motionFrames,
      );
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
      // Pattern is decorative: a render failure must never abort the export.
    }
  }
  // Position the content min-corner at the padding offset.
  ctx.translate(pad - draw.x, pad - draw.y);
  // The writing, over the page and under every element (its zones' elements sit over it).
  if (writing) {
    await document.fonts?.ready;
    drawArticleOps(ctx, writing.ops);
  }
  // `ordered` keeps frame sections behind their contents
  // (docs/specs/008-canvas/canvas-and-palette.md).
  const resolveImage = opts.images ? (id: string) => opts.images!.get(id)?.image : undefined;
  // Elements the canvas drawers can't reproduce (tables, freehand, shape
  // silhouettes, rotation, icon glyphs: boxedNeedsSvgRaster) rasterise via
  // the SAME svg markup the SVG export emits, so the PNG/PDF output can't
  // drift from it. Pre-rendered async here (the draw loop below stays
  // sync), padded for stroke overflow, and for the rotated bounding box
  // when the element carries a rotation, since svgBoxed bakes the rotation
  // into the markup and it sweeps outside the unrotated box. A failed
  // rasterise falls back to drawBoxed's plain box.
  // The tab default face (docs/specs/004-interface-design/fonts.md) every element without its own inherits.
  const tabFont = tab.font;
  // Webfont bytes for the faces in play. A rasterised fragment is loaded as
  // an <img>, which blocks external resources outright, so a marker note
  // would come back in the fallback face unless the font travels INSIDE the
  // markup. Fetched once here and inlined into every fragment below.
  const fontCss =
    opts.fontCss ?? (await embeddedFontFaceCss([...exportFontIds(els, tab.font, tab.finish)]));
  // The canvas drawers paint through the DOM's own font set, so wait for it
  // to settle: rasterising mid-swap bakes the fallback face into the PNG.
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
        ...chartInk,
        resolveTabWindow: opts.resolveTabWindow,
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
    try {
      ctx.drawImage(await svgToImage(svg), ax, ay, aw, ah);
    } catch {
      // As every other raster here: an arrow run the browser will not draw never aborts the export.
    }
  };
  for (const { el, alpha } of ordered) {
    if (el.type === 'arrow') {
      const svg = svgZoneClipped(
        el.id,
        svgArrow(el, tab.elements, surface, tabFont, labels, undefined, els, paper, tab.finish),
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
