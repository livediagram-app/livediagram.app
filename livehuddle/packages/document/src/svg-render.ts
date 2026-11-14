// Headless SVG renderer for a tab's elements (livediagram/docs/specs/015-api/mcp-server.md §5). Extracted from the
// editor's export pipeline (apps/editor/lib/export-tab.ts) so the SAME element
// drawing serves both the in-app SVG/PNG export AND the MCP worker's inline
// render — one renderer, two callers, no DOM. The per-element drawers
// (svgBoxed / labels) and their pure helpers live here; the in-app
// export keeps only its isometric + backdrop-pattern orchestration on top.
//
// Text measurement degrades to a char-width estimate when there's no DOM
// (Workers / jsdom), so wrapping still works headless.

import { faceFinishOf, finishWobblesArt, isHandDrawn, resolveFinish, type Finish } from './finish';
import {
  SKETCH_ART_FILTER_ID,
  svgSketchArtDefs,
  svgSketchedBody,
  svgSketchFace,
} from './svg-render-sketch';
import { svgMarkerFace, svgProfessionalFace } from './svg-render-face-finish';
import { sketchBackdropIds } from './sketch-backdrop';
import { acceptsInlineIcon, canvasSurface } from './colors';
import { inlineIconLayout } from './svg-render-inline-icon';
import { svgIconShape, svgImageShape } from './svg-render-image-icon';
// Which body an element draws, and the list of kinds that have one (docs/specs/020-import-export/export-fidelity.md).
import { shapeHasBespokeBody, svgElementBody } from './svg-render-body';
import { isRetiredElement } from './retired-kinds';
import { svgRetiredArrow, svgRetiredElement } from './svg-render-retired';
import { retiredArrowBounds } from './retired-arrow';
import { buildElementIndex, type ElementIndex } from './geometry';
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
import { svgWordmarkLabel } from './svg-render-wordmark';
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
import type { BoxedElement, Element, Tab } from './index';
import { paintOrder } from './paint-order';
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
  type BoxedExportOptions,
  type ExportIconArt,
  type ExportShape,
  type ExportStickerArt,
  type ResolveEmojiArt,
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
  finishOf,
  type BoxedExportOptions,
  type ResolveEmojiArt,
  type ResolveIconArt,
  type ResolveImageHref,
  type ResolveStickerArt,
} from './svg-render-describe';
// Typefaces (docs/specs/004-interface-design/fonts.md): an export paints the face the canvas painted, and
// declares the ones it used so the file stands on its own.
import { googleFontsHref } from '@liveworkspace/model-core/fonts';
import { boundsOfPoints, type Point } from '@liveworkspace/model-core/geometry-primitives';
import { borderedRect } from './svg-render-border';
import { resolveStockColours } from './stock-colours';
import { rotationOf } from './rotation';

// Bounding box of the visible content: boxed elements via their rectangle, a stored arrow via its line and
// placeholder card (./retired-arrow). Empty / degenerate tabs default to a page.
export function contentBounds(elements: Element[]): { x: number; y: number; w: number; h: number } {
  const points: Point[] = [];
  // One index for every stored arrow's ends: an array per arrow made this quadratic in the arrows.
  let index: ElementIndex | null = null;
  for (const el of elements) {
    if (el.type === 'arrow') {
      index ??= buildElementIndex(elements);
      const b = retiredArrowBounds(el, index);
      points.push({ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y + b.height });
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
  // Every word on the element in its face, so a face that writes its own (a panel's rows, a button) wears the tab's
  // font and finish as on the canvas; a word that names its own face keeps it.
  const face = exportFontFamily(source, opts.tabFont, opts.tabFinish);
  const drawn = svgBoxedFace(source, opts);
  const out = face ? drawn.replace(/^<g/, `<g font-family="${xmlEscape(face)}"`) : drawn;
  const finish = faceFinishOf(source, resolveFinish(finishOf(source), opts.tabFinish));
  const open = out.indexOf('>') + 1;
  const close = out.lastIndexOf('</g>');
  const inner = out.slice(open, close);
  // Under Sketch a face is drawn by hand, its words crisp (docs/specs/008-canvas/finish.md "Every other face is
  // drawn by hand too"); under Professional its rectangles go square and its lines thin ("Faces").
  if (finish === 'sketch')
    return (
      out.slice(0, open) +
      svgSketchFace(
        svgMarkerFace(inner, source.id, { width: source.width, height: source.height }, 'pencil'),
      ) +
      out.slice(close)
    );
  if (finish === 'professional')
    return out.slice(0, open) + svgProfessionalFace(inner) + out.slice(close);
  // Under Marker its frames and shapes are drawn in marker ("Faces: frames and shapes").
  if (finish === 'marker')
    return (
      out.slice(0, open) +
      svgMarkerFace(inner, source.id, { width: source.width, height: source.height }) +
      out.slice(close)
    );
  return out;
}

function svgBoxedFace(source: BoxedElement, opts: BoxedExportOptions): string {
  const surface = opts.surface ?? 'light';
  // A stock colour stored by name is drawn in its version for this page.
  const el = resolveStockColours(source, surface);
  const { opacity, shape, label: described } = describeBoxedExport(el, opts);
  let label = described;
  // What a self-drawing element writes its own text in: the label's resolved
  // colour and face, so a chart's key and a rail's captions read like every
  // other label on the canvas.
  const labelColor = label?.color ?? defaultTextColor(el, surface);
  const fontFamily = label?.fontFamily ?? exportFontFamily(el, opts.tabFont, opts.tabFinish);
  // The drawing style (docs/specs/008-canvas/finish.md): Professional's borders and corners, Sketch's or Marker's
  // hand-drawn body. Null when this element is not drawn by hand.
  const finish = resolveFinish(finishOf(el), opts.tabFinish);
  const sketch = isHandDrawn(finish)
    ? svgSketchedBody(el, shape, finish, !!opts.sketchBackdrop)
    : null;
  const opAttr = opacity !== 1 ? ` opacity="${r2(opacity)}"` : '';
  // Rotation applies to the whole element (body + label) about its centre,
  // exactly like the canvas wrapper's CSS rotate.
  const rotation = rotationOf(el);
  const rotAttr = rotation
    ? ` transform="rotate(${r2(rotation)} ${r2(el.x + el.width / 2)} ${r2(el.y + el.height / 2)})"`
    : '';
  // Drop shadow (docs/specs/008-canvas/element-shadows.md): reference the shared feDropShadow def the
  // document emitter collects via svgShadowDefs (deterministic id, so
  // this stays in lockstep without threading the def through).
  const shadow = supportsShadow(el) ? el.shadow : undefined;
  const shadowAttr = shadow ? ` filter="url(#${shadowFilterId(shadow)})"` : '';
  let shapeStr = '';
  if (isRetiredElement(el)) {
    // A kind or type livehuddle no longer has (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements"): its
    // placeholder card, in place of its body, border and label.
    return `<g${opAttr}${rotAttr}>${svgRetiredElement(el, surface, fontFamily, !!opts.retiredOutlines)}</g>`;
  }
  if (shape.kind === 'image') {
    shapeStr =
      (shape.href
        ? svgImageShape(el, shape.href, shape.objectFit, shape.radius)
        : `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="6"` +
          ` fill="${EXPORT_IMAGE_FILL}" stroke="${EXPORT_IMAGE_STROKE}" stroke-width="1.5" stroke-dasharray="4 4"/>`) +
      // Its hand-drawn edge (finish.md "Images"), over the image. A stored hero caption is not drawn
      // (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3).
      (sketch ?? '');
  } else if (shape.kind === 'rect') {
    // A box: a sticky is die-cut paper, square corners as on the canvas; anything else rounds a little. The diagram
    // shapes' silhouettes (a circle, a diamond, a cylinder) left with them
    // (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5).
    const rx = el.type === 'sticky' ? 0 : 6;
    // What this element draws INSTEAD of (or under) a plain label: its plot,
    // its value, its rows, its face. See svg-render-body.
    const face = svgElementBody(el, {
      labelColor,
      fontFamily,
      stroke: shape.stroke,
      fill: shape.fill,
      label: label?.text ?? el.label ?? '',
      surface,
      resolveIconArt: opts.resolveIconArt,
      resolveEmojiArt: opts.resolveEmojiArt,
      finish,
    });
    // A SELF-PAINTING element's body is its own: the canvas gives it a
    // wrapper with no border and no background (element-variant.ts), and the
    // export drew one anyway, framing every chart, progress element, rating
    // and rail in a box that is not on the canvas. Also gated on having drawn
    // a face, so a self-painting kind the export cannot draw yet (portal, an
    // unresolved icon) still renders its box rather than nothing at all. A
    // record and a page are NOT self-painting: their rows and masthead sit
    // inside a real box, so they keep it.
    const selfPainting = el.type === 'shape' && SELF_PAINTING_SHAPES.has(el.shape);
    const box =
      sketch ??
      (selfPainting && face
        ? ''
        : el.type === 'shape'
          ? // A shape's border is the element's own (width, dash, radius), inset
            // like the canvas's CSS border (svg-render-border).
            borderedRect(el, shape.fill, shape.stroke, undefined, finish)
          : `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="${r2(rx)}" fill="${xmlEscape(shape.fill)}" stroke="${xmlEscape(shape.stroke)}" stroke-width="1.5"/>`);
    shapeStr = box + face;
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
  // Icons and stickers under Sketch draw through the hand-drawn wobble (docs/specs/008-canvas/finish.md), as on the
  // canvas; the export carries the filter's defs (svgSketchArtDefs).
  if (
    finish === 'sketch' &&
    finishWobblesArt(el) &&
    (shape.kind === 'icon' || shape.kind === 'sticker')
  )
    shapeStr = `<g filter="url(#${SKETCH_ART_FILTER_ID})">${shapeStr}</g>`;
  // An inline icon beside the label, as the canvas lays it out (svg-render-inline-icon); it moves the label aside.
  const iconArt =
    el.type === 'shape' &&
    acceptsInlineIcon(el) &&
    el.iconId &&
    shape.kind === 'rect' &&
    !selfLabelled(el)
      ? opts.resolveIconArt?.(el.iconId)
      : undefined;
  const inline =
    iconArt && el.type === 'shape'
      ? inlineIconLayout(el, label, iconArt, labelColor, el.textSize ?? 'scale')
      : null;
  if (inline) label = inline.label;
  if (inline) shapeStr += inline.icon;
  // A self-drawing element renders NO standard label on the canvas (its own
  // content is what it shows), so the export must not print one either: a
  // chart came out with "pie-chart" centred in the middle of it.
  const labelStr =
    !label || selfLabelled(el)
      ? ''
      : el.type === 'text' && hasWordmarkType(el)
        ? // Tracking, weight, case and arc (docs/specs/007-editor/editor-modes.md "Pages moved to livedocuments").
          svgWordmarkLabel(el, label)
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
// svgBoxed markup instead. Retired placeholders, shape silhouettes,
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
  // A retired element (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements") is the SVG's placeholder
  // card, which the canvas drawers have no drawer for: a stored table or embed would otherwise export as a bare box.
  if (isRetiredElement(el)) return true;
  // Wordmark type (tracking, weight, case, an arc) is drawn by the SVG alone.
  if (el.type === 'text' && hasWordmarkType(el)) return true;
  // Anything whose BODY this module draws and the canvas drawers cannot: a
  // chart's plot, a progress value, a card's face, a lane's gutter, a
  // browser's chrome. Without this the PNG / PDF export kept drawing them as
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
// MCP inline images match what the canvas shows. No isometric projection or
// backdrop pattern — those are in-app export extras (apps/editor/lib/export-tab).
export function renderElementsToSvg(
  tab: Tab,
  opts: {
    padding?: number;
    background?: string;
    resolveImageHref?: ResolveImageHref;
    resolveIconArt?: ResolveIconArt;
    resolveStickerArt?: ResolveStickerArt;
    resolveEmojiArt?: ResolveEmojiArt;
    // Retired elements as their placeholder's outline alone (BoxedExportOptions.retiredOutlines).
    retiredOutlines?: boolean;
  } = {},
): string {
  const padding = opts.padding ?? EXPORT_PADDING;
  const visible = tab.elements;
  // Shapes something sits on keep a solid fill under Sketch (sketch-backdrop.ts), as on the canvas.
  const backdrops = sketchBackdropIds(visible, tab.finish);
  const bounds = contentBounds(visible);
  const vbX = bounds.x - padding;
  const vbY = bounds.y - padding;
  const vbW = bounds.w + padding * 2;
  const vbH = bounds.h + padding * 2;
  const bg = opts.background ?? tab.backgroundColor ?? EXPORT_BG;
  // What you export is what you see: an element with no colours of its own is
  // drawn in the ink of the paper it is being exported onto (docs/specs/007-editor/editor-app.md), so a
  // dark canvas exports dark-canvas elements rather than pale ones.
  const surface = canvasSurface(bg);
  // One index for every stored arrow's ends, built on the first.
  let index: ElementIndex | null = null;
  const tabIndex = () => (index ??= buildElementIndex(visible));
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW)}" height="${r2(vbH)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
    `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${xmlEscape(bg)}"/>`,
  ];
  // Webfont declarations for the faces this tab uses (docs/specs/004-interface-design/fonts.md).
  const fontDefs = svgFontDefs(exportFontIds(visible, tab.font, tab.finish));
  if (fontDefs) parts.push(fontDefs);
  // Element-shadow filter defs (docs/specs/008-canvas/element-shadows.md); empty string when none.
  const shadowDefs = svgShadowDefs(visible);
  if (shadowDefs) parts.push(shadowDefs);
  const sketchArtDefs = svgSketchArtDefs(visible, tab.finish);
  if (sketchArtDefs) parts.push(sketchArtDefs);
  // In the canvas's paint order (docs/specs/006-document/layers.md "Stacking"): a stored arrow's placeholder
  // interleaves with the boxes by array order, as on the canvas.
  parts.push(
    ...paintOrder(tab.elements).map((el) =>
      el.type === 'arrow'
        ? svgRetiredArrow(
            el,
            tabIndex(),
            surface,
            exportFontFamily({}, tab.font, tab.finish),
            opts.retiredOutlines,
          )
        : svgBoxed(el, {
            resolveImageHref: opts.resolveImageHref,
            resolveIconArt: opts.resolveIconArt,
            resolveStickerArt: opts.resolveStickerArt,
            resolveEmojiArt: opts.resolveEmojiArt,
            tabFont: tab.font,
            tabFinish: tab.finish,
            sketchBackdrop: backdrops.has(el.id),
            surface,
            paper: bg,
            retiredOutlines: opts.retiredOutlines,
          }),
    ),
  );
  parts.push('</svg>');
  return parts.join('\n');
}
