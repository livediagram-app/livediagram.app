// Headless SVG renderer for a tab's elements (docs/specs/015-api/mcp-server.md §5). Extracted from the
// editor's export pipeline (apps/live/lib/export-tab.ts) so the SAME element
// drawing serves both the in-app SVG/PNG export AND the MCP worker's inline
// render — one renderer, two callers, no DOM. The per-element drawers
// (svgBoxed / svgArrow / labels) and their pure helpers live here; the in-app
// export keeps only its isometric + backdrop-pattern orchestration on top.
//
// Text measurement degrades to a char-width estimate when there's no DOM
// (Workers / jsdom), so wrapping still works headless.

import type { Item, ItemTypeDef } from '@livediagram/items';
import { svgPlanBoard, svgPlanCard } from './svg-render-plan';
import {
  hasShapeSilhouette,
  scaledPolygonPoints,
  svgChecklistShape,
  svgLaneGutter,
  svgBrowserChrome,
  svgLegendShape,
  svgCodeBlockShape,
  svgFreehandShape,
  svgPathElementShape,
  svgShapeSilhouette,
} from './svg-render-shapes';
import { MIND_NODE_RADIUS_PX, cornerRadiusPx } from './border-style';
import { canvasSurface } from './colors';
import { svgIconShape, svgImageShape } from './svg-render-image-icon';
import { DIAMOND_POINTS } from './shape-geometry';
import { svgTableShape } from './svg-render-table';
// Which body an element draws, and the list of kinds that have one (docs/specs/020-import-export/export-fidelity.md).
import { shapeHasBespokeBody, svgElementBody } from './svg-render-body';
import { svgPageFold } from './svg-render-page';
import { svgHeroCaption } from './svg-render-web';
import { defaultTextColor, SELF_PAINTING_SHAPES } from './colors';
// Text/number primitives shared with the per-element emitters — re-exported
// below so existing importers of this module keep resolving.
import { labelMeasure, r2, wrapLabel, xmlEscape } from './svg-render-primitives';

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
import { svgRichWrappedLabel, svgWrappedLabel } from './svg-render-labels';

export {
  EXPORT_DEFAULT_FONT,
  BLANK_LINE,
  svgFontFamilyAttr,
  svgLabel,
  svgRichLabel,
  svgRichWrappedLabel,
  svgWrappedLabel,
  wrapExportRuns,
  type ExportLabel,
  type ExportRun,
} from './svg-render-labels';
import { arrowLabelFontStack, svgArrow } from './svg-render-arrows';
import { arrowLabelPass, arrowRoutePoints, type ArrowLabelPass } from './arrow-label-layout';

export { arrowHeadRefs, arrowLabelFontStack, svgArrow, svgArrowhead } from './svg-render-arrows';
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
  EXPORT_IMAGE_LABEL,
  EXPORT_IMAGE_STROKE,
  EXPORT_PADDING,
  exportFontFamily,
  exportFontIds,
  type BoxedExport,
  type BoxedExportOptions,
  type ExportIconArt,
  type ExportShape,
  type ExportStickerArt,
  type ResolveIconArt,
  type ResolveImageHref,
  type ResolveStickerArt,
} from './svg-render-describe';
import {
  describeBoxedExport,
  selfLabelled,
  EXPORT_BG,
  EXPORT_IMAGE_FILL,
  EXPORT_IMAGE_STROKE,
  EXPORT_PADDING,
  exportFontFamily,
  exportFontIds,
  type BoxedExportOptions,
  type ResolveIconArt,
  type ResolveImageHref,
  type ResolveStickerArt,
} from './svg-render-describe';
// Typefaces (docs/specs/004-interface-design/fonts.md): an export paints the face the canvas painted, and
// declares the ones it used so the file stands on its own.
import { googleFontsHref } from './fonts';
import { boundsOfPoints, type Point } from './geometry-primitives';
import { getBuiltInTheme } from './themes';
import { themeChartPalette } from './theme-presets';
import { borderedRect, borderOf, strokeAttrs } from './svg-render-border';
import { resolveStockColours } from './stock-colours';

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

export function svgBoxed(source: BoxedElement, opts: BoxedExportOptions = {}): string {
  const surface = opts.surface ?? 'light';
  // A stock colour stored by name is drawn in its version for this page.
  const el = resolveStockColours(source, surface);
  const { opacity, shape, label } = describeBoxedExport(el, opts);
  // What a self-drawing element writes its own text in: the label's resolved
  // colour and face, so a chart's key and a rail's captions read like every
  // other label on the canvas.
  const labelColor = label?.color ?? defaultTextColor(el, surface);
  const fontFamily = label?.fontFamily ?? exportFontFamily(el, opts.tabFont);
  const opAttr = opacity !== 1 ? ` opacity="${r2(opacity)}"` : '';
  // Rotation applies to the whole element (body + label) about its centre,
  // exactly like the canvas wrapper's CSS rotate.
  const rotation = el.rotation ?? 0;
  const rotAttr = rotation
    ? ` transform="rotate(${r2(rotation)} ${r2(el.x + el.width / 2)} ${r2(el.y + el.height / 2)})"`
    : '';
  // Drop shadow (docs/specs/008-canvas/element-shadows.md): reference the shared feDropShadow def the
  // document emitter collects via svgShadowDefs (deterministic id, so
  // this stays in lockstep without threading the def through).
  const shadow = supportsShadow(el) ? el.shadow : undefined;
  const shadowAttr = shadow ? ` filter="url(#${shadowFilterId(shadow)})"` : '';
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  let shapeStr = '';
  if (el.type === 'table') {
    // The real grid (tracks / headers / zebra / per-cell text), not a
    // box-with-nothing. Tables carry no element label; the cells are the
    // content.
    return `<g${opAttr}${rotAttr}>${svgTableShape(el, surface)}</g>`;
  }
  if (el.type === 'freehand' && shape.kind === 'rect') {
    // The sketch's actual polyline instead of its bounding box.
    return `<g${opAttr}${rotAttr}>${svgFreehandShape(el, shape.stroke, shape.fill)}</g>`;
  }
  if (el.type === 'path' && shape.kind === 'rect') {
    // The path's own curve (docs/specs/023-draw-mode/path-tool.md "Export").
    return `<g${opAttr}${rotAttr}>${svgPathElementShape(el, shape.stroke, shape.fill)}</g>`;
  }
  if (el.type === 'shape' && el.shape === 'code-block') {
    // The dark editor card + plain mono lines (docs/specs/009-elements/code-block.md); no label.
    return `<g${opAttr}${rotAttr}${shadowAttr}>${svgCodeBlockShape(el)}</g>`;
  }
  if (el.type === 'shape' && el.shape === 'legend' && shape.kind === 'rect') {
    // The key card with its swatch + label rows (docs/specs/009-elements/pie-chart.md).
    return `<g${opAttr}${rotAttr}${shadowAttr}>${svgLegendShape(
      el,
      shape.fill,
      shape.stroke,
      el.textColor ?? '#1e293b',
    )}</g>`;
  }
  if (el.type === 'shape' && (el.shape === 'plan-board' || el.shape === 'plan-card')) {
    // Columns of cards, or one card, drawn from the document's items (docs/specs/025-plan/plan-board.md).
    const body =
      el.shape === 'plan-board'
        ? svgPlanBoard(el, opts.items, surface, opts.itemTypes)
        : svgPlanCard(el, opts.items, surface, opts.itemTypes);
    return `<g${opAttr}${rotAttr}${shadowAttr}>${body}</g>`;
  }
  if (el.type === 'shape' && el.shape === 'checklist' && shape.kind === 'rect') {
    // The themed to-do card with its rows + done-count footer (docs/specs/009-elements/checklist.md).
    return `<g${opAttr}${rotAttr}${shadowAttr}>${svgChecklistShape(
      el,
      shape.fill,
      shape.stroke,
      el.textColor ?? '#1e293b',
    )}</g>`;
  }
  if (shape.kind === 'image') {
    shapeStr =
      (shape.href
        ? svgImageShape(el, shape.href, shape.objectFit, shape.radius)
        : `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="6"` +
          ` fill="${EXPORT_IMAGE_FILL}" stroke="${EXPORT_IMAGE_STROKE}" stroke-width="1.5" stroke-dasharray="4 4"/>`) +
      // A hero's caption card (docs/specs/009-elements/web-components-and-no-groups.md), over the image.
      (el.type === 'image' ? svgHeroCaption(el, fontFamily) : '');
  } else if (shape.kind === 'ellipse') {
    // Inset by half the border, as the canvas's CSS border sits inside.
    const b = el.type === 'shape' ? borderOf(el) : { width: 1.5, dash: null };
    shapeStr = `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(Math.max(0, el.width / 2 - b.width / 2))}" ry="${r2(Math.max(0, el.height / 2 - b.width / 2))}" fill="${xmlEscape(shape.fill)}"${strokeAttrs(shape.stroke, b.width, b.dash)}/>`;
  } else if (shape.kind === 'diamond') {
    // Native at element coordinates, from the shared table's points, inset
    // by half the border so the tips stay inside the box (strokeInside).
    const b = el.type === 'shape' ? borderOf(el) : { width: 1.5, dash: null };
    const inset = b.width / 2;
    const points = scaledPolygonPoints(
      DIAMOND_POINTS,
      el.x + inset,
      el.y + inset,
      Math.max(0, el.width - b.width),
      Math.max(0, el.height - b.width),
    );
    shapeStr = `<polygon points="${points}" fill="${xmlEscape(shape.fill)}"${strokeAttrs(shape.stroke, b.width, b.dash)} stroke-linejoin="round"/>`;
  } else if (shape.kind === 'rect') {
    // Shape silhouettes (hexagon / cylinder / document / devices / actor /
    // frame ...) mirror the editor overlay's geometry; kinds without one
    // (square / sticky / text-box / cards) stay a rounded rect, with the
    // stadium's full pill radius as the one native special case.
    const silhouette =
      el.type === 'shape' && hasShapeSilhouette(el.shape)
        ? svgShapeSilhouette(el, shape.fill, shape.stroke)
        : null;
    const rx =
      el.type === 'shape' && el.shape === 'stadium'
        ? Math.min(el.width, el.height) / 2
        : // A sticky is die-cut paper: square corners, matching the canvas.
          el.type === 'sticky'
          ? 0
          : // A mind node is a soft-cornered pill-ish box (docs/specs/009-elements/mind-node.md), the one
            // rect kind the canvas rounds further than the usual 6, and the one
            // that honours its corner-radius pick (a round bubble-map node).
            el.type === 'shape' && el.shape === 'mind-node'
            ? Math.min(
                cornerRadiusPx(el.borderRadius, el.width, el.height, MIND_NODE_RADIUS_PX),
                Math.min(el.width, el.height) / 2,
              )
            : 6;
    // What this element draws INSTEAD of (or under) a plain label: its plot,
    // its value, its rows, its face. See svg-render-body.
    const face = svgElementBody(el, {
      labelColor,
      fontFamily,
      stroke: shape.stroke,
      fill: shape.fill,
      chartPalette: opts.chartPalette,
      label: label?.text ?? el.label ?? '',
      surface,
    });
    // A SELF-PAINTING element's body is its own: the canvas gives it a
    // wrapper with no border and no background (element-variant.ts), and the
    // export drew one anyway, framing every chart, progress element, rating
    // and rail in a box that is not on the canvas. Also gated on having drawn
    // a face, so a self-painting kind the export cannot draw yet (portal, an
    // unresolved icon) still renders its box rather than nothing at all. A
    // record and a page are NOT self-painting: their rows and masthead sit
    // inside a real box, so they keep it. A silhouette always wins: an actor
    // IS its figure.
    const selfPainting = el.type === 'shape' && SELF_PAINTING_SHAPES.has(el.shape);
    const box =
      silhouette ??
      (selfPainting && face
        ? ''
        : el.type === 'shape'
          ? // A shape's border is the element's own (width, dash, radius), inset
            // like the canvas's CSS border (svg-render-border). A stadium and a
            // mind node keep their silhouette radius.
            borderedRect(
              el,
              shape.fill,
              shape.stroke,
              el.shape === 'stadium' || el.shape === 'mind-node' ? rx : undefined,
            )
          : `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="${r2(rx)}" fill="${xmlEscape(shape.fill)}" stroke="${xmlEscape(shape.stroke)}" stroke-width="1.5"/>`);
    // What the canvas draws ON the box: a lane's title gutter (docs/specs/009-elements/lane.md) and a
    // browser frame's chrome strip (docs/specs/008-canvas/canvas-and-palette.md).
    const onBox =
      el.type === 'shape' && el.shape === 'lane'
        ? svgLaneGutter(el, shape.stroke)
        : el.type === 'shape' && el.shape === 'browser'
          ? svgBrowserChrome(el, shape.stroke)
          : el.type === 'shape' && el.shape === 'page'
            ? svgPageFold(el, shape.fill, shape.stroke, opts.paper ?? '#ffffff')
            : '';
    shapeStr = box + onBox + face;
  } else if (shape.kind === 'icon') {
    shapeStr = svgIconShape(el, shape.art, shape.stroke);
  } else if (shape.kind === 'sticker') {
    // The sticker's own art, nested over the whole element box. Its viewBox
    // comes from the builder (square for an emoji, a wide pill for a badge)
    // and `meet` keeps the plate un-warped, matching the canvas.
    shapeStr =
      `<svg x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}"` +
      ` viewBox="${shape.art.viewBox}" preserveAspectRatio="xMidYMid meet" overflow="visible">` +
      `${shape.art.markup}</svg>`;
  }
  // A self-drawing element renders NO standard label on the canvas (its own
  // content is what it shows), so the export must not print one either: a
  // chart came out with "pie-chart" centred in the middle of it.
  const labelStr =
    !label || selfLabelled(el)
      ? ''
      : label.runs
        ? svgRichWrappedLabel(
            label.runs,
            label.x,
            label.y,
            label.anchor,
            label.maxWidth,
            label.valign,
            label.fontFamily,
          )
        : svgWrappedLabel(
            // Wrapped in the face it paints in, or a wide face breaks at the
            // wrong words and runs out of its element.
            wrapLabel(
              label.text,
              label.maxWidth,
              labelMeasure(label.size, label.bold, label.italic, label.fontFamily),
              !(el.type === 'shape' && el.shape === 'icon'),
            ),
            label.x,
            label.y,
            label.anchor,
            label.color,
            label.size,
            label.bold,
            label.italic,
            label.valign,
            label.fontFamily,
          );
  // An upright lane title turns about its frame's corner (docs/specs/009-elements/lane.md).
  const turned =
    labelStr && label?.turnAbout
      ? `<g transform="rotate(-90 ${r2(label.turnAbout.x)} ${r2(label.turnAbout.y)})">${labelStr}</g>`
      : labelStr;
  return `<g${opAttr}${rotAttr}${shadowAttr}>${shapeStr}${turned}</g>`;
}

// The <style> block declaring the webfonts an export actually used
// (docs/specs/004-interface-design/fonts.md), so the file carries its own typography instead of relying on
// the reader having Permanent Marker installed. Empty when nothing on the
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
): boolean {
  if (el.rotation) return true;
  // A shadow renders via an feDropShadow filter def (docs/specs/008-canvas/element-shadows.md), which the
  // PNG canvas drawers can't reproduce natively.
  if (supportsShadow(el) && el.shadow) return true;
  if (el.type === 'table' || el.type === 'freehand' || el.type === 'path') return true;
  if (el.type === 'shape' && (hasShapeSilhouette(el.shape) || el.shape === 'stadium')) return true;
  // Anything whose BODY this module draws and the canvas drawers cannot: a
  // chart's plot, a progress value, a card's face, a lane's gutter, a
  // browser's chrome. Without this the PNG / PDF export kept drawing them as
  // plain boxes while the SVG export drew them properly, which is the same
  // inconsistency one file down.
  if (el.type === 'shape' && shapeHasBespokeBody(el.shape)) return true;
  if (el.type === 'shape' && el.shape === 'icon' && el.iconId && resolveIconArt?.(el.iconId))
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
// MCP inline images match what the canvas shows. No isometric projection or
// backdrop pattern — those are in-app export extras (apps/live/lib/export-tab).
export function renderElementsToSvg(
  tab: Tab,
  opts: {
    padding?: number;
    background?: string;
    resolveImageHref?: ResolveImageHref;
    resolveIconArt?: ResolveIconArt;
    resolveStickerArt?: ResolveStickerArt;
    // The document's items, so Plan boards and cards draw their cards (docs/specs/025-plan/plan-board.md).
    items?: ReadonlyMap<string, Item>;
    // The document's item types (docs/specs/025-plan/item-types.md).
    itemTypes?: readonly ItemTypeDef[];
  } = {},
): string {
  const padding = opts.padding ?? EXPORT_PADDING;
  const visible = visibleLayerElements(tab.elements, tab.layers);
  // Every caption laid out once, in document order, so labels see each other.
  const labels = arrowLabelPass(tab.elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tab.font),
  });
  const bounds = contentBounds(visible, labels);
  const vbX = bounds.x - padding;
  const vbY = bounds.y - padding;
  const vbW = bounds.w + padding * 2;
  const vbH = bounds.h + padding * 2;
  const bg = opts.background ?? tab.backgroundColor ?? EXPORT_BG;
  // What you export is what you see: an element with no colours of its own is
  // drawn in the ink of the paper it is being exported onto (docs/specs/007-editor/live-app.md), so a
  // dark canvas exports dark-canvas elements rather than pale ones.
  const surface = canvasSurface(bg);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW)}" height="${r2(vbH)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
    `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${xmlEscape(bg)}"/>`,
  ];
  // Webfont declarations for the faces this tab uses (docs/specs/004-interface-design/fonts.md), including
  // the one the event-storming notation asks for on its notes.
  // The categorical ramp the tab's theme gives its charts (docs/specs/009-elements/pie-chart.md), which is
  // what the canvas hands them. Without it every exported chart fell back to
  // the built-in ramp and came out in different colours to the canvas.
  const chartPalette = themeChartPalette(
    getBuiltInTheme(tab.theme, surface === 'dark' ? 'dark' : 'light'),
  );
  const fontDefs = svgFontDefs(exportFontIds(visible, tab.font));
  if (fontDefs) parts.push(fontDefs);
  // Element-shadow filter defs (docs/specs/008-canvas/element-shadows.md); empty string when none.
  const shadowDefs = svgShadowDefs(visible);
  if (shadowDefs) parts.push(shadowDefs);
  // Per band, in the canvas's paint order (docs/specs/006-document/layers.md): arrows and boxes
  // interleave by array order, so an arrow sent behind a box stays behind it.
  // A dimmed layer wraps its band in a <g opacity>.
  for (const band of layerBands(tab.elements, tab.layers)) {
    const inner = band.elements.map((el) =>
      el.type === 'arrow'
        ? svgArrow(el, tab.elements, surface, tab.font, labels, undefined, visible, bg)
        : svgBoxed(el, {
            resolveImageHref: opts.resolveImageHref,
            resolveIconArt: opts.resolveIconArt,
            resolveStickerArt: opts.resolveStickerArt,
            tabFont: tab.font,
            surface,
            paper: bg,
            chartPalette,
            items: opts.items,
            itemTypes: opts.itemTypes,
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
