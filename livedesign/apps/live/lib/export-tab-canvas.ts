// The PNG / PDF path (export-tab.ts): a tab drawn onto a canvas, rasterising through the SVG export's own markup
// what the canvas drawers cannot draw. Split out of export-tab.ts, which re-exports renderTabToCanvas.

import { photoImageKey } from './export-tab-images';
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
} from '@livedesign/design';
import { exportScale, MAX_EXPORT_CANVAS_SIDE } from '@liveworkspace/model-core/export-canvas';
import {
  canvasSurface,
  boxedNeedsSvgRaster,
  contentBounds,
  describeBoxedExport,
  EXPORT_BG,
  EXPORT_PADDING,
  r2,
  supportsShadow,
  svgArrow,
  sketchBackdropIds,
  svgBoxed,
  svgShadowDefs,
} from '@livedesign/design';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { drawBoxed } from './export-tab-canvas-draw';
import { EXPORT_PAPER, pageExportFrame } from './export-page';
import { pageScreenRect, tabWireframeFrameTheme, tagColoursOf } from '@livedesign/design';
import { exportChartInk } from './export-chart-ink';
import { paintMotionFrame } from './page-motion-canvas';
import { embeddedFontFaceCss } from './export-fonts';
import { expandForExport } from './component-registry';
import { backgroundPatternDefs, type ImageExportOpts } from './export-tab-parts';
import {
  boundsWithInk,
  inkProbeMargin,
  inkRasterPad,
  measureInk,
  type InkRect,
} from './export-ink-bounds';

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

// A rasterised element's pad round its box: 2 px for stroke overflow, the rotated bounding box's sweep when it is
// turned (svgBoxed bakes the rotation into the markup), and a shadow's offset + blur
// (docs/specs/008-canvas/element-shadows.md), whose filter def the fragment inlines.
function rasterBasePad(el: BoxedElement): number {
  const diag = Math.hypot(el.width, el.height);
  const shadow = supportsShadow(el) && el.shadow ? el.shadow : undefined;
  const shadowPad = shadow
    ? Math.max(Math.abs(shadow.offsetX), Math.abs(shadow.offsetY)) + shadow.blur
    : 0;
  return (el.rotation ? (diag - Math.min(el.width, el.height)) / 2 + 2 : 2) + shadowPad;
}

export async function renderTabToCanvas(
  source: Tab,
  opts: ImageExportOpts = {},
): Promise<HTMLCanvasElement> {
  // Each instance drawn as its main's elements (docs/specs/009-elements/components.md "How an instance draws").
  const tab = expandForExport(source);
  const frame = opts.page
    ? pageExportFrame(opts.page, {
        transparentPaper: opts.transparentPaper,
        imageHref: (id) => opts.images?.get(id)?.href,
        frameTheme: tabWireframeFrameTheme(tab),
        // A photo page draws its photo's preview (loadTabImages), as the SVG export does: without it
        // the PNG and PDF showed the empty-photo placeholder.
        photoHref: (pageId) => opts.images?.get(photoImageKey(pageId))?.href,
      })
    : null;
  const chartInk = exportChartInk(tab, opts.page);
  // A card's tag colour (docs/specs/009-elements/tag-colours.md): the canvas, exports and thumbnails agree.
  const tagColours = tagColoursOf(tab);
  const reaches = (el: Element) => !frame || frame.reaches(el, tab.elements);
  // Hidden layers drop out of the export (bounds included) unless the
  // dialog's include-hidden option is on (docs/specs/006-design/layers.md). `ordered` is the
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
  const boxBounds = frame ? frame.bounds : contentBounds(els, labels, tab.elements);
  const pad = frame ? 0 : (opts.padding ?? EXPORT_PADDING);
  const canvas = document.createElement('canvas');
  // No 2D context (a non-DOM test run): the canvas is only sized, nothing is drawn or measured.
  const ctx = canvas.getContext('2d');
  // Background colour, painted across the whole canvas; the pattern (if on) sits over it.
  const bgColor = tab.backgroundColor ?? EXPORT_BG;
  // Elements that carry no colours of their own are drawn in the ink of the
  // paper being exported onto (docs/specs/007-editor/live-app.md), so a dark canvas exports dark-canvas
  // elements rather than pale ones.
  const surface = frame ? frame.surface : (opts.surface ?? canvasSurface(bgColor));
  // The tab default face (docs/specs/004-interface-design/fonts.md) every element without its own inherits.
  const tabFont = tab.font;
  // Webfont bytes for the faces in play. A rasterised fragment is loaded as
  // an <img>, which blocks external resources outright, so a marker note
  // would come back in the fallback face unless the font travels INSIDE the
  // markup. Fetched once here and inlined into every fragment below.
  const fontCss = ctx
    ? (opts.fontCss ?? (await embeddedFontFaceCss(exportFontIds(els, tab.font, tab.finish))))
    : '';
  // The canvas drawers paint through the DOM's own font set, so wait for it
  // to settle: rasterising mid-swap bakes the fallback face into the PNG.
  if (ctx) await document.fonts?.ready;
  const fontDefs = fontCss ? `<defs><style type="text/css">${fontCss}</style></defs>` : '';
  // Elements the canvas drawers can't reproduce (tables, freehand, shape
  // silhouettes, rotation, icon glyphs: boxedNeedsSvgRaster) rasterise via
  // the SAME svg markup the SVG export emits, so the PNG/PDF output can't
  // drift from it.
  const rastered = ctx
    ? els.filter(
        (el): el is BoxedElement =>
          el.type !== 'arrow' &&
          isBoxed(el) &&
          boxedNeedsSvgRaster(el, resolveIconArtLoaded, resolveStickerArtLoaded, tab.finish),
      )
    : [];
  // A text's ink can reach past its box (docs/specs/020-import-export/export-fidelity.md "Ink past a text's box is
  // kept"): each rasterised text is measured once at 1x, its raster padded by the ink past its box, and an export
  // cut to its content grows to take that ink in.
  const inkPads = new Map<string, number>();
  const inks: InkRect[] = [];
  const probe = document.createElement('canvas');
  for (const el of rastered) {
    if (el.type !== 'text') continue;
    const basePad = rasterBasePad(el);
    const size = describeBoxedExport(el, { tabFont, surface }).label?.size ?? 0;
    const margin = basePad + inkProbeMargin(size);
    const area = {
      x: el.x - margin,
      y: el.y - margin,
      w: el.width + margin * 2,
      h: el.height + margin * 2,
    };
    const ink = await measureInk(fragment(el, margin, 1), area, svgToImage, probe);
    if (!ink) continue;
    inks.push(ink);
    const inkPad = inkRasterPad(el, ink, basePad);
    if (inkPad > basePad) inkPads.set(el.id, inkPad);
  }
  // A page's edge is the picture's edge; only an export cut to its content grows.
  const bounds = frame || inks.length === 0 ? boxBounds : boundsWithInk(boxBounds, inks);
  const draw = bounds;
  // 2x for crisp output, lowered so no side passes the largest canvas every browser draws (a Fit to
  // Content page reaches 19200 px, docs/specs/007-editor/pages-mode.md "Sizes").
  const scale = exportScale(opts.scale ?? 2, draw.w + pad * 2, draw.h + pad * 2);
  const w = (draw.w + pad * 2) * scale;
  const h = (draw.h + pad * 2) * scale;
  // A part pixel rounds up, so an element cut to its own box (Inspect's export, 360.5 x 55.9) keeps its last row
  // and column; a hair under a whole one (float noise) stays whole, and no side passes the canvas limit.
  const pixels = (n: number) =>
    Math.max(1, Math.min(MAX_EXPORT_CANVAS_SIDE, Math.ceil(n - PART_PIXEL_NOISE)));
  canvas.width = pixels(w);
  canvas.height = pixels(h);
  renderedScale.set(canvas, scale);
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  // The paper under the content: a hollow arrowhead is filled with it, as on the canvas.
  const paper = frame ? EXPORT_PAPER : bgColor;
  ctx.fillStyle = paper;
  if (!frame?.transparent && !(opts.transparent && !frame))
    ctx.fillRect(0, 0, w / scale, h / scale);
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
    // A slide's animated background, still as the slide opens, over its gradient and under all on
    // it (docs/specs/007-editor/pages-mode.md "Animated backgrounds").
    const pageFill = opts.page?.background?.fill;
    if (opts.page && pageFill?.kind === 'gradient' && pageFill.motion) {
      // A wireframe page's motion is its screen's, cut to it (its frame stays as drawn).
      const r = pageScreenRect(opts.page);
      if (frame.clipPath) {
        ctx.save();
        ctx.translate(-x, -y);
        ctx.clip(new Path2D(frame.clipPath));
        ctx.translate(x, y);
      }
      paintMotionFrame(
        ctx,
        pageFill.motion,
        pageFill,
        { x: r.x - x, y: r.y - y, width: r.width, height: r.height },
        opts.motionFrames,
      );
      if (frame.clipPath) ctx.restore();
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
  // `ordered` keeps frame sections behind their contents
  // (docs/specs/008-canvas/canvas-and-palette.md).
  const resolveImage = opts.images ? (id: string) => opts.images!.get(id)?.image : undefined;
  // The rasterised elements, pre-rendered async here (the draw loop below
  // stays sync) with their pad (rasterBasePad, or the measured ink's). A
  // failed rasterise falls back to drawBoxed's plain box.
  const rasterImages = new Map<string, { image: HTMLImageElement; pad: number }>();
  for (const el of rastered) {
    const pad = inkPads.get(el.id) ?? rasterBasePad(el);
    try {
      rasterImages.set(el.id, { image: await svgToImage(fragment(el, pad, scale)), pad });
    } catch {
      // Fall through to drawBoxed's plain box below.
    }
  }
  // One pass in the canvas's paint order (docs/specs/006-design/layers.md): arrows and boxes
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
  // A wireframe page's elements are cut to its screen (docs/specs/007-editor/wireframe-pages.md
  // "Export"); its system bars go over them below.
  if (frame?.clipPath) {
    ctx.save();
    ctx.clip(new Path2D(frame.clipPath));
  }
  // One arrow that fails to draw is skipped and logged, never the whole export (export-fidelity.md).
  let arrowRun: { id: string; svg: string }[] = [];
  const arrowLayer = (markup: string) =>
    svgToImage(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(aw * scale)}" height="${r2(ah * scale)}"` +
        ` viewBox="${r2(ax)} ${r2(ay)} ${r2(aw)} ${r2(ah)}">${fontDefs}${markup}</svg>`,
    );
  const flushArrows = async () => {
    if (arrowRun.length === 0) return;
    const run = arrowRun;
    arrowRun = [];
    try {
      ctx.drawImage(await arrowLayer(run.map((a) => a.svg).join('')), ax, ay, aw, ah);
      return;
    } catch {
      // The run as one layer failed: draw its arrows one by one, so only the broken one is lost.
    }
    for (const a of run) {
      try {
        ctx.drawImage(await arrowLayer(a.svg), ax, ay, aw, ah);
      } catch {
        console.warn('[export] arrow skipped', { elementId: a.id });
      }
    }
  };
  for (const { el, alpha } of ordered) {
    if (el.type === 'arrow') {
      let svg: string;
      try {
        svg = svgArrow(
          el,
          tab.elements,
          surface,
          tabFont,
          labels,
          undefined,
          els,
          paper,
          tab.finish,
        );
      } catch {
        console.warn('[export] arrow skipped', { elementId: el.id });
        continue;
      }
      arrowRun.push({ id: el.id, svg: alpha < 1 ? `<g opacity="${r2(alpha)}">${svg}</g>` : svg });
      continue;
    }
    await flushArrows();
    drawOne(ctx, el, alpha);
  }
  await flushArrows();
  if (frame?.clipPath) {
    ctx.restore();
    if (frame.overlaySvg) {
      const { x, y, w: fw, h: fh } = frame.bounds;
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(fw * scale)}" height="${r2(fh * scale)}"` +
        ` viewBox="${r2(x)} ${r2(y)} ${r2(fw)} ${r2(fh)}">${fontDefs}${frame.overlaySvg}</svg>`;
      try {
        ctx.drawImage(await svgToImage(svg), x, y, fw, fh);
      } catch {
        // The bars are the frame's dressing: a failed paint must never abort the export.
      }
    }
  }
  return canvas;

  // One element's SVG markup, the SAME the SVG export emits, over its box grown by `pad` each side, `at` pixels
  // per canvas px.
  function fragment(el: BoxedElement, pad: number, at: number): string {
    const w = el.width + pad * 2;
    const h = el.height + pad * 2;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(w * at)}" height="${r2(h * at)}"` +
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
        tagColours,
        ...chartInk,
        resolveTabWindow: opts.resolveTabWindow,
      })}</svg>`
    );
  }

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
