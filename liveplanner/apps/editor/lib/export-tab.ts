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

import type { IsDoneStatus, Item, ItemTypeDef } from '@liveplanner/items';
import {
  arrowLabelFontStack,
  arrowLabelPass,
  isBoxed,
  layerBands,
  layerOpacityOf,
  exportFontIds,
  visibleLayerElements,
  type ArrowElement,
  type ArrowLineMotion,
  type BoxedElement,
  type ResolvePlanArt,
  type ResolveTabWindow,
  type SheetRenderModel,
  type Tab,
} from '@liveplanner/project';
// Shared SVG render helpers (docs/specs/015-api/mcp-server.md §5): moved into the project package so the
// MCP worker reuses the same element drawing. The canvas / backdrop
// orchestration below stays here and imports the per-element drawers + helpers.
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
  svgFontDefs,
  svgShadowDefs,
  xmlEscape,
} from '@liveplanner/project';
import { backgroundPatternTile } from './canvas-backgrounds';
import {
  resolveIconArtLoaded,
  resolveStickerArtLoaded,
} from '@liveworkspace/workbench/lib/icon-registry';
import { drawBoxed } from './export-tab-canvas-draw';
import { exportChartInk } from './export-chart-ink';

// Shared options for the image exports (PNG / SVG / PDF). `pattern` paints the tab's backdrop pattern (grid / dots /
// …); on by default, the user can switch it off in the Export dialog.
// Image elements export as their empty placeholder (pictures are never uploaded); only an inline picture (a
// layout tile's sample art, a `data:` id) draws, through inlineImageHref.
// `hiddenLayers` INCLUDES layers the user has hidden (docs/specs/006-project/layers.md); off by default
// so the export matches what the canvas shows.
// An image id that is itself the picture (a `data:` URL) draws as it is; any other id has no bytes to show.
const inlineImageHref = (id: string): string | undefined =>
  id.startsWith('data:') ? id : undefined;

export type ImageExportOpts = {
  pattern?: boolean;
  hiddenLayers?: boolean;
  // Embedded @font-face rules for the faces this tab uses (docs/specs/004-interface-design/fonts.md), from
  // embeddedFontFaceCss. Absent = the SVG falls back to declaring the
  // Google stylesheet by @import, which only a browser opening the file
  // directly will honour.
  fontCss?: string;
  // The project's items, so Plan boards and cards export with their cards
  // (docs/specs/026-plan/plan-board.md "Both elements everywhere").
  items?: ReadonlyMap<string, Item>;
  // And its item types (docs/specs/026-plan/item-types.md), so custom types keep their colour.
  itemTypes?: readonly ItemTypeDef[];
  // The statuses the plan's boards count as done, for the blocked badge (docs/specs/026-plan/item-types.md
  // "Blocked By").
  itemsDone?: IsDoneStatus;
  // Each Sheet's window of cells by sheet id (docs/specs/029-sheets/sheet.md "Exports and images"), from the sheet
  // store (plan-export-sheets.ts). Without it a Sheet draws its frame and headers alone.
  sheets?: ReadonlyMap<string, SheetRenderModel>;
  // A plan view's picture (docs/specs/026-plan/plan-tabs.md "Export"), drawn by the editor, which has the charts'
  // models; without it a plan view draws as its labelled box.
  resolvePlanArt?: ResolvePlanArt;
  // Each tab window's tab drawn (docs/specs/009-elements/tab-window.md "Exports"), and the typefaces those tabs write
  // in, so their words export in their own faces; without it a window draws its frame named for its tab.
  resolveTabWindow?: ResolveTabWindow;
  tabWindowFontIds?: readonly string[];
  // The drawing set moving rather than still (docs/specs/009-elements/tab-window.md "The drawing"): each arrow's
  // flow, as the canvas draws it, so the page's own motion stylesheets play it. Only a tab window passes it (an
  // inline SVG on the page); every file export is a still.
  motion?: SvgMotion;
};

// How an element moves in a live inline SVG: the moving line for an arrow's flow. Undefined for one that holds still.
export type SvgMotion = {
  arrowLine: (el: ArrowElement) => ArrowLineMotion | undefined;
};

// Webfont embedding for downloads (docs/specs/004-interface-design/fonts.md) — the bytes travel with the file.
import { embeddedFontFaceCss } from './export-fonts';

// Default backdrop pattern colour when a tab leaves it unset (matches the
// editor's fallback).
export const EXPORT_PATTERN_COLOR = '#cbd5e1'; // slate-300

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
  const chartInk = exportChartInk(tab);
  // Hidden layers drop out of the export (bounds included) unless the
  // dialog's include-hidden option is on (docs/specs/006-project/layers.md). `ordered` is the
  // paint order — layer bands bottom -> top, frames first per band —
  // with each element carrying its band's opacity factor.
  const els = opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers);
  const ordered = layerBands(tab.elements, tab.layers, {
    includeHidden: opts.hiddenLayers,
  }).flatMap((band) => band.elements.map((el) => ({ el, alpha: layerOpacityOf(band.layer) })));
  // Every caption laid out once, as the canvas and the SVG export do
  // (docs/specs/008-canvas/arrow-labels.md); the bounds include the plates.
  // Shapes something sits on keep a solid fill under Sketch, as on the canvas (sketch-backdrop.ts).
  const backdrops = sketchBackdropIds(els, tab.finish);
  const labels = arrowLabelPass(tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font, tab.finish),
  });
  const bounds = contentBounds(els, labels);
  const pad = EXPORT_PADDING;
  const draw = bounds;
  // 2x for crisp output, lowered so no side passes the largest canvas every browser draws.
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
  // Background colour, painted across the whole canvas; the pattern (if on) sits over it.
  const bgColor = tab.backgroundColor ?? EXPORT_BG;
  // Elements that carry no colours of their own are drawn in the ink of the
  // paper being exported onto (docs/specs/007-editor/editor-app.md), so a dark canvas exports dark-canvas
  // elements rather than pale ones.
  const surface = canvasSurface(bgColor);
  // The paper under the content: a hollow arrowhead is filled with it, as on the canvas.
  const paper = bgColor;
  ctx.fillStyle = paper;
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
    opts.fontCss ??
    (await embeddedFontFaceCss([
      ...exportFontIds(els, tab.font, opts.sheets, tab.finish),
      ...(opts.tabWindowFontIds ?? []),
    ]));
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
    // def (the fragment has no project <defs> to resolve against).
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
        resolveImageHref: inlineImageHref,
        resolveIconArt: resolveIconArtLoaded,
        resolveStickerArt: resolveStickerArtLoaded,
        tabFont,
        tabFinish: tab.finish,
        sketchBackdrop: backdrops.has(el.id),
        surface,
        ...chartInk,
        items: opts.items,
        itemTypes: opts.itemTypes,
        itemsDone: opts.itemsDone,
        sheets: opts.sheets,
        resolvePlanArt: opts.resolvePlanArt,
        resolveTabWindow: opts.resolveTabWindow,
      })}</svg>`;
    try {
      rasterImages.set(el.id, { image: await svgToImage(svg), pad });
    } catch {
      // Fall through to drawBoxed's plain box below.
    }
  }
  // One pass in the canvas's paint order (docs/specs/006-project/layers.md): arrows and boxes
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
      const svg = svgArrow(
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
      arrowRun.push(alpha < 1 ? `<g opacity="${r2(alpha)}">${svg}</g>` : svg);
      continue;
    }
    await flushArrows();
    drawOne(ctx, el, alpha);
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
    drawBoxed(c, el, undefined, alpha, tabFont, surface);
  }
}

// Exported so the export dialog can render a live preview of the image
// export (docs/specs/010-palette/style-presets.md): same SVG the .svg download produces, and PNG / PDF
// rasterise the same content, so one SVG preview faithfully represents all
// three image formats under the current pattern option.

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
  const bounds = contentBounds(els, labels);
  const pad = EXPORT_PADDING;
  const draw = bounds;
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
    : svgFontDefs([
        ...exportFontIds(els, tab.font, opts.sheets, tab.finish),
        ...(opts.tabWindowFontIds ?? []),
      ]);
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
  // Within each band: boxed elements first, then arrows on top (same
  // z-order as the canvas); bands stack bottom -> top with frame
  // sections behind their band-mates (docs/specs/006-project/layers.md + docs/specs/008-canvas/canvas-and-palette.md).
  for (const band of bands) {
    const inner: string[] = [];
    for (const el of band.elements) {
      if (el.type !== 'arrow')
        inner.push(
          svgBoxed(el, {
            resolveImageHref: inlineImageHref,
            resolveIconArt: resolveIconArtLoaded,
            resolveStickerArt: resolveStickerArtLoaded,
            tabFont: tab.font,
            tabFinish: tab.finish,
            sketchBackdrop: backdrops.has(el.id),
            surface,
            ...chartInk,
            items: opts.items,
            itemTypes: opts.itemTypes,
            itemsDone: opts.itemsDone,
            sheets: opts.sheets,
            resolvePlanArt: opts.resolvePlanArt,
            resolveTabWindow: opts.resolveTabWindow,
          }),
        );
    }
    for (const el of band.elements) {
      if (el.type === 'arrow')
        inner.push(
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
            opts.motion?.arrowLine(el),
          ),
        );
    }
    parts.push(wrapBand(layerOpacityOf(band.layer), inner));
  }
  parts.push('</svg>');
  return parts.join('\n');
}

// A downloaded SVG carries its own typefaces: the reader hasn't got
// Permanent Marker installed, and an @import is dead in an offline viewer.
export async function exportTabAsSvg(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  const els = opts.hiddenLayers ? tab.elements : visibleLayerElements(tab.elements, tab.layers);
  const fontCss =
    opts.fontCss ??
    (await embeddedFontFaceCss([
      ...exportFontIds(els, tab.font, opts.sheets, tab.finish),
      ...(opts.tabWindowFontIds ?? []),
    ]));
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
