// Headless SVG renderer for a tab's elements (docs/specs/015-api/mcp-server.md §5). Extracted from the
// editor's export pipeline (apps/editor/lib/export-tab.ts) so the SAME element
// drawing serves both the in-app SVG/PNG export AND the MCP worker's inline
// render — one renderer, two callers, no DOM. The per-element drawers
// (svgBoxed / svgArrow / labels) and their pure helpers live here; the in-app
// export keeps only its backdrop-pattern orchestration on top.
//
// Text measurement degrades to a char-width estimate when there's no DOM
// (Workers / jsdom), so wrapping still works headless.

import { PAGE_EXPORT_PAPER, type PageExportFrame } from './page-frame';
import type { ResolveTabWindow } from './tab-window';
import { hasShapeSilhouette } from './svg-render-shapes';
import { resolveFinish, type Finish } from './finish';
import { svgSketchArtDefs } from './svg-render-sketch';
import { sketchBackdropIds } from './sketch-backdrop';
import { acceptsInlineIcon, canvasSurface } from './colors';
// Which body an element draws, and the list of kinds that have one (docs/specs/020-import-export/export-fidelity.md).
import { shapeHasBespokeBody } from './svg-render-body';
// Text/number primitives shared with the per-element emitters — re-exported
// below so existing importers of this module keep resolving.
import { r2, xmlEscape } from './svg-render-primitives';

export {
  estimatedLabelMeasure,
  fontSizeFor,
  LABEL_ESTIMATE_CHAR_EM,
  LABEL_LINE_HEIGHT,
  labelMaxWidth,
  labelMeasure,
  r2,
  wrapLabel,
  xmlEscape,
} from './svg-render-primitives';
import { hasTextEffects } from './svg-render-text-effects';
import { hasWordmarkType } from './wordmark';

export {
  EXPORT_DEFAULT_FONT,
  BLANK_LINE,
  svgFontFamilyAttr,
  svgRichWrappedLabel,
  svgWrappedLabel,
  wrapExportRuns,
  type ExportLabel,
  type ExportRun,
} from './svg-render-labels';
import { arrowLabelFontStack, svgArrow } from './svg-render-arrows';
import { arrowLabelPass, arrowRoutePoints, type ArrowLabelPass } from './arrow-label-layout';

export { arrowLabelFontStack, svgArrow, svgArrowhead } from './svg-render-arrows';
import type { BoxedElement, Element, Tab } from './index';
import { layerBands, layerOpacityOf, visibleLayerElements } from './layers';
// Element drop shadows (docs/specs/008-canvas/element-shadows.md): gate + deterministic filter defs.
import { shadowFilterId, supportsShadow, svgShadowFilterDef } from './shadow';

// The export descriptor layer (constants, ExportShape / resolver types,
// describeBoxedExport) lives in svg-render-describe.ts; re-exported so
// existing importers of this module keep resolving.
export {
  describeBoxedExport,
  drawsStandardLabel,
  labelRoom,
  selfLabelled,
  EXPORT_BG,
  EXPORT_IMAGE_FILL,
  EXPORT_IMAGE_STROKE,
  EXPORT_PADDING,
  exportFontFamily,
  exportFontIds,
  finishOf,
  type BoxedExportOptions,
  type ExportIconArt,
  type ExportShape,
  type ExportStickerArt,
  type ResolveIconArt,
  type ResolveImageHref,
  type ResolveStickerArt,
} from './svg-render-describe';
import {
  EXPORT_BG,
  EXPORT_PADDING,
  exportFontIds,
  finishOf,
  type ResolveIconArt,
  type ResolveImageHref,
  type ResolveStickerArt,
} from './svg-render-describe';
// Typefaces (docs/specs/004-interface-design/fonts.md): an export paints the face the canvas painted, and
// declares the ones it used so the file stands on its own.
import { googleFontsHref } from '@liveworkspace/model-core/fonts';
import { boundsOfPoints, type Point } from '@liveworkspace/model-core/geometry-primitives';
import { getBuiltInTheme } from './themes';
import { themeChartPalette } from './theme-presets';
// The border an element resolves to, for the office exports' native shapes (docs/specs/020-import-export/office-export.md).
export { borderOf } from './svg-render-border';
import { resolvedAccentEdge } from './accent-edge';
import { isPointerNote, pointerTipOf } from './pointer-note';
import { rotationOf } from './rotation';
import { tagColoursOf } from './tag-colours';
import { svgBoxed } from './svg-render-boxed';
export { svgBoxed } from './svg-render-boxed';

// Bounding box of the visible content. Arrows count via free endpoints; boxed
// elements via their rectangle. Empty / degenerate tabs default to a page.
// Arrows count by their drawn route (a bow can swing well outside the boxes
// it joins) and, when a label pass is given, by their label plates.
export function contentBounds(
  elements: Element[],
  labels?: ArrowLabelPass,
): { x: number; y: number; w: number; h: number } {
  const points: Point[] = [];
  for (const el of elements) {
    if (el.type === 'arrow') {
      points.push(...arrowRoutePoints(el, elements));
      const l = labels?.layouts.get(el.id);
      if (l) {
        points.push(
          { x: l.center.x - l.width / 2, y: l.center.y - l.height / 2 },
          { x: l.center.x + l.width / 2, y: l.center.y + l.height / 2 },
        );
      }
    } else {
      points.push({ x: el.x, y: el.y }, { x: el.x + el.width, y: el.y + el.height });
      // A pointer note's tip can sit well outside its box (docs/specs/009-elements/pointer-note.md).
      if (isPointerNote(el)) {
        const t = pointerTipOf(el);
        points.push(
          { x: el.x + t.x - 4, y: el.y + t.y - 4 },
          { x: el.x + t.x + 4, y: el.y + t.y + 4 },
        );
      }
    }
  }
  const b = boundsOfPoints(points);
  if (!b || !Number.isFinite(b.x)) return { x: 0, y: 0, w: 600, h: 400 };
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

// Resolve a boxed element to its export descriptor: branch decision + resolved
// colours + label, using the SAME element-type defaults the editor renders so
// a theme-deferring element exports with its rendered look.

export { svgIconShape } from './svg-render-image-icon';

// The <style> block declaring the webfonts an export actually used
// (docs/specs/004-interface-design/fonts.md), so the file carries its own typography instead of relying on
// the reader having Shantell Sans installed. Empty when nothing on the
// tab picked a face, keeping a plain export byte-identical to before.
//
// An `@import` of the Google stylesheet, not embedded font bytes: it keeps
// the file small and the renderer free of IO (it also runs in a Worker with
// no fetch budget for font binaries). The trade-off is honest — opened as a
// standalone file in a browser the faces load; in an offline vector editor,
// or when the SVG is used as an <img> src (which blocks external
// resources), the stack's system fallback paints instead, which is the same
// progressive-enhancement deal the canvas makes.
export function svgFontDefs(fontIds: readonly string[]): string {
  if (fontIds.length === 0) return '';
  const href = googleFontsHref(fontIds);
  return `<defs><style type="text/css">@import url("${xmlEscape(href)}");</style></defs>`;
}

// The <defs> block for every distinct element shadow in the list (docs/specs/008-canvas/element-shadows.md):
// one feDropShadow filter per unique value, ids matching what svgBoxed
// references. Empty string when nothing carries a shadow, so shadow-less
// documents stay byte-identical to before.
export function svgShadowDefs(elements: Element[]): string {
  const defs = new Map<string, string>();
  for (const el of elements) {
    if (el.type === 'arrow' || !supportsShadow(el) || !el.shadow) continue;
    const id = shadowFilterId(el.shadow);
    if (!defs.has(id)) defs.set(id, svgShadowFilterDef(el.shadow));
  }
  return defs.size ? `<defs>${[...defs.values()].join('')}</defs>` : '';
}

// True when svgBoxed draws something the PNG canvas drawers (drawBoxed)
// can't reproduce natively — the caller then rasterises this element's
// svgBoxed markup instead. Tables, freehand sketches, shape silhouettes,
// rotation, and resolved icon art all fall in.
export function boxedNeedsSvgRaster(
  el: BoxedElement,
  resolveIconArt?: ResolveIconArt,
  resolveStickerArt?: ResolveStickerArt,
  // The tab's finish (docs/specs/008-canvas/finish.md): the canvas drawers know only Flexible's borders.
  tabFinish?: Finish,
): boolean {
  if (rotationOf(el)) return true;
  if (resolveFinish(finishOf(el), tabFinish) !== 'flexible') return true;
  // A shadow renders via an feDropShadow filter def (docs/specs/008-canvas/element-shadows.md), which the
  // PNG canvas drawers can't reproduce natively.
  if (supportsShadow(el) && el.shadow) return true;
  // An accent edge (docs/specs/008-canvas/accent-edge.md) is a clipped bar only the SVG draws.
  if (resolvedAccentEdge(el)) return true;
  if (el.type === 'table' || el.type === 'freehand') return true;
  // A highlighted or gradient word (docs/specs/008-canvas/text-effects.md) is a band rect or a gradient fill only
  // the SVG draws.
  if (hasTextEffects(el)) return true;
  // Wordmark type (tracking, weight, case, an arc) is drawn by the SVG alone.
  if (el.type === 'text' && hasWordmarkType(el)) return true;
  if (el.type === 'shape' && (hasShapeSilhouette(el.shape) || el.shape === 'stadium')) return true;
  // Anything whose BODY this module draws and the canvas drawers cannot: a
  // chart's plot, a progress value, a card's face, a browser's chrome. Without this the PNG / PDF export kept drawing them as
  // plain boxes while the SVG export drew them properly, which is the same
  // inconsistency one file down.
  if (el.type === 'shape' && shapeHasBespokeBody(el.shape)) return true;
  if (el.type === 'shape' && el.shape === 'icon' && el.iconId && resolveIconArt?.(el.iconId))
    return true;
  // An inline icon beside a label (svg-render-inline-icon) is drawn by the SVG alone.
  if (el.type === 'shape' && acceptsInlineIcon(el) && el.iconId && resolveIconArt?.(el.iconId))
    return true;
  // A sticker is drawn art (plate + shadow + emoji or badge text) with no
  // canvas-drawer equivalent, so it always rasterises through its SVG.
  if (
    el.type === 'shape' &&
    el.shape === 'sticker' &&
    el.stickerId &&
    resolveStickerArt?.(el.stickerId)
  )
    return true;
  return false;
}

// Render a tab's elements to a complete SVG string on a solid background, sized
// to the content bounds with padding. Layer bands paint bottom -> top with
// frame sections behind their band-mates (docs/specs/006-document/layers.md + docs/specs/008-canvas/canvas-and-palette.md), everything else
// in array order as on the canvas. Hidden layers are skipped, so server snapshots (docs/specs/006-document/document-snapshots.md) and
// MCP inline images match what the canvas shows. No backdrop pattern — that is an
// in-app export extra (apps/editor/lib/export-tab).
export function renderElementsToSvg(
  tab: Tab,
  opts: {
    padding?: number;
    background?: string;
    resolveImageHref?: ResolveImageHref;
    resolveIconArt?: ResolveIconArt;
    resolveStickerArt?: ResolveStickerArt;
    // Each tab window's tab (docs/specs/009-elements/tab-window.md "Exports"); its frame named for its tab without.
    resolveTabWindow?: ResolveTabWindow;
    // One page as an export draws it (page-frame.ts, svg-render-pages.ts): the drawing is the
    // page's rect, painted with its background, its elements inked for it; only the elements reaching it are drawn.
    // `writingSvg` goes over the page and under every element (an article's writing).
    frame?: PageExportFrame & { writingSvg?: string };
  } = {},
): string {
  const frame = opts.frame;
  const padding = frame ? 0 : (opts.padding ?? EXPORT_PADDING);
  const visible = visibleLayerElements(tab.elements, tab.layers).filter(
    (el) => !frame || frame.reaches(el, tab.elements),
  );
  // Shapes something sits on keep a solid fill under Sketch (sketch-backdrop.ts), as on the canvas.
  const backdrops = sketchBackdropIds(visible, tab.finish);
  // Every caption laid out once, in document order, so labels see each other.
  const labels = arrowLabelPass(tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font, tab.finish),
  });
  const bounds = frame ? frame.bounds : contentBounds(visible, labels);
  const vbX = bounds.x - padding;
  const vbY = bounds.y - padding;
  const vbW = bounds.w + padding * 2;
  const vbH = bounds.h + padding * 2;
  const bg = frame ? PAGE_EXPORT_PAPER : (opts.background ?? tab.backgroundColor ?? EXPORT_BG);
  // What you export is what you see: an element with no colours of its own is
  // drawn in the ink of the paper it is being exported onto (docs/specs/007-editor/editor-app.md), so a
  // dark canvas exports dark-canvas elements rather than pale ones.
  const surface = frame ? frame.surface : canvasSurface(bg);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW)}" height="${r2(vbH)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
    frame
      ? frame.backgroundSvg
      : `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${xmlEscape(bg)}"/>`,
  ];
  if (frame?.writingSvg) parts.push(frame.writingSvg);
  // Webfont declarations for the faces this tab uses (docs/specs/004-interface-design/fonts.md).
  // The categorical ramp the tab's theme gives its charts (docs/specs/009-elements/pie-chart.md), which is
  // what the canvas hands them. Without it every exported chart fell back to
  // the built-in ramp and came out in different colours to the canvas.
  const chartPalette = themeChartPalette(
    getBuiltInTheme(tab.theme, surface === 'dark' ? 'dark' : 'light'),
  );
  const fontDefs = svgFontDefs(exportFontIds(visible, tab.font, tab.finish));
  if (fontDefs) parts.push(fontDefs);
  // Element-shadow filter defs (docs/specs/008-canvas/element-shadows.md); empty string when none.
  const shadowDefs = svgShadowDefs(visible);
  if (shadowDefs) parts.push(shadowDefs);
  const sketchArtDefs = svgSketchArtDefs(visible, tab.finish);
  if (sketchArtDefs) parts.push(sketchArtDefs);
  // Per band, in the canvas's paint order (docs/specs/006-document/layers.md): arrows and boxes
  // interleave by array order, so an arrow sent behind a box stays behind it.
  // A dimmed layer wraps its band in a <g opacity>.
  // The tab's tag colours (docs/specs/009-elements/tag-colours.md): a mapped card's edge and chips.
  const tagColours = tagColoursOf(tab);
  for (const band of layerBands(tab.elements, tab.layers)) {
    const shown = frame
      ? band.elements.filter((el) => frame.reaches(el, tab.elements))
      : band.elements;
    const inner = shown.map((el) =>
      el.type === 'arrow'
        ? svgArrow(el, tab.elements, surface, tab.font, labels, undefined, visible, bg, tab.finish)
        : svgBoxed(el, {
            resolveImageHref: opts.resolveImageHref,
            resolveIconArt: opts.resolveIconArt,
            resolveStickerArt: opts.resolveStickerArt,
            tabFont: tab.font,
            tabFinish: tab.finish,
            sketchBackdrop: backdrops.has(el.id),
            surface,
            paper: bg,
            chartPalette,
            resolveTabWindow: opts.resolveTabWindow,
            tagColours,
          }),
    );
    const opacity = layerOpacityOf(band.layer);
    parts.push(
      opacity < 1 ? `<g opacity="${r2(opacity)}">${inner.join('\n')}</g>` : inner.join('\n'),
    );
  }
  parts.push('</svg>');
  return parts.join('\n');
}
