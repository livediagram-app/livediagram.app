// The export descriptor layer of the headless SVG renderer (docs/specs/015-api/mcp-server.md
// §5), split out of svg-render.ts: the export constants, the
// ExportShape / resolver types, and describeBoxedExport — the pure
// element -> shape + label descriptor both the per-element emitters and
// the in-app canvas drawer consume. The emitters stay in svg-render.ts.

import type { ResolveTabWindow } from './tab-window';
import type { TagColour } from './tag-colours';
import { imageCornerPx } from './drawn-outline-finish';
import {
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
  type CanvasSurface,
} from './colors';
import { fontIdsUsed, resolveFontStack } from './fonts';
import { elementFontId, isFinish, resolveFinish, type Finish } from './finish';
import { hasRichFormatting } from './rich-text';
import { iconCaptionBand } from './icon-size';
import { fontSizeFor, labelMaxWidth } from './svg-render-primitives';
import { isSelfDrawingShape } from './data-shapes';
import { isWebComponentShape } from './web-components';
import type { ExportLabel, ExportRun } from './svg-render-labels';
import { PADDING_PX } from './index';
import { chipColours, chipLookOf, isChipShape } from './chip';
import type { BoxedElement, TextRun } from './index';
import { runFontPx } from './label-font';
import { resolveStockColours } from './stock-colours';
import { DEFAULT_BACKGROUND_COLOR } from './canvas-colors';
import { labelBodyInset } from './label-body';

export const EXPORT_PADDING = 32;
// A tab that stores no canvas colour is on the Default theme: its light canvas.
export const EXPORT_BG = DEFAULT_BACKGROUND_COLOR;
export const EXPORT_IMAGE_FILL = '#f1f5f9'; // slate-100 placeholder body
export const EXPORT_IMAGE_STROKE = '#94a3b8'; // slate-400 placeholder dashes
const EXPORT_IMAGE_LABEL = '#64748b'; // slate-500 alt-text label

// `image` carries the resolved bitmap render info: `href` is a data URL when a
// caller has supplied the bytes (the bitmap is embedded), else undefined (a
// dashed placeholder is drawn — e.g. a headless thumbnail with no bytes on
// hand). `objectFit` / `radius` mirror the on-screen ImageElementView so cover
// crops, contain letterboxes, and avatars clip to a circle. `none` is a
// label-only element (text); the rest carry resolved fill + stroke. `icon` is
// a shape==='icon' element whose glyph a caller resolved (see ResolveIconArt);
// it keeps fill/stroke so the isometric extrusion can tint its silhouette
// column like any other box.
export type ExportShape =
  | { kind: 'image'; href?: string; objectFit: 'cover' | 'contain'; radius: number }
  | { kind: 'ellipse'; fill: string; stroke: string }
  | { kind: 'diamond'; fill: string; stroke: string }
  | { kind: 'rect'; fill: string; stroke: string }
  | { kind: 'icon'; art: ExportIconArt; fill: string; stroke: string }
  // A sticker (docs/specs/010-palette/stickers.md): fully self-coloured art (plate, shadow, content)
  // that fills the element box. No fill / stroke, because a sticker has
  // neither — its colours are its own.
  | { kind: 'sticker'; art: ExportStickerArt }
  | { kind: 'none' };

// Resolves an image element's `imageId` to a data URL to embed, or undefined
// to fall back to the placeholder. The bytes are fetched / read by the caller
// (the browser export prefetches via the authenticated image API; a future
// worker path could read R2), keeping this renderer free of any IO.
export type ResolveImageHref = (imageId: string) => string | undefined;

// Resolved glyph art for a shape==='icon' element, in a 0..24 art box.
// `colored: false` is line art: the markup carries no colours and the
// renderer wraps it with the element's stroke colour (icons tint + theme
// like line drawings on the canvas). `colored: true` is a Technology brand
// mark: the markup is self-coloured (brand tile + white glyph) and is never
// recoloured. Matches @livedocuments/icons' IconExportArt structurally — kept
// structural so this package doesn't depend on the catalogue package; each
// caller supplies a resolver (the editor from its async icon registry, the
// Workers from @livedocuments/icons/resolve). No resolver, or an unknown id,
// falls back to the pre-icon output: a plain box with the centred label.
export type ExportIconArt = { markup: string; colored: boolean };
export type ResolveIconArt = (iconId: string) => ExportIconArt | undefined;

// Resolved artwork for a shape==='sticker' element (docs/specs/010-palette/stickers.md): self-coloured
// markup plus the viewBox it was drawn in. Structural, for the same reason
// ExportIconArt is — this package never imports the catalogue; each caller
// passes a resolver (the editor from its async registry, the Workers from
// @livedocuments/icons/resolve). No resolver, or an unknown id, falls back to
// the plain box-with-label output.
export type ExportStickerArt = { viewBox: string; markup: string };
export type ResolveStickerArt = (stickerId: string) => ExportStickerArt | undefined;

type BoxedExport = { opacity: number; shape: ExportShape; label: ExportLabel | null };

// What an export needs from its caller beyond the element itself: the three
// art resolvers, and the tab's default font (docs/specs/004-interface-design/fonts.md) — an element without
// its own face inherits the tab's, so a renderer that doesn't pass it paints
// the wrong typeface for the whole canvas.
export type BoxedExportOptions = {
  resolveImageHref?: ResolveImageHref;
  // The tab's tag colours (docs/specs/009-elements/tag-colours.md): a mapped card's accent edge and tinted chips.
  tagColours?: readonly TagColour[];
  resolveIconArt?: ResolveIconArt;
  resolveStickerArt?: ResolveStickerArt;
  tabFont?: string;
  // The tab's finish (docs/specs/008-canvas/finish.md), for elements without their own.
  tabFinish?: Finish;
  // Something sits on this shape (sketch-backdrop.ts): under Sketch it keeps a solid fill.
  sketchBackdrop?: boolean;
  // The paper the export is being drawn on, for elements that carry no
  // colours of their own (docs/specs/007-editor/live-app.md). Defaults to light, so a caller that
  // doesn't say gets exactly the output it always got.
  surface?: CanvasSurface;
  // The paper colour under the element, for what cuts through to it (a page's fold).
  paper?: string;
  // The tab theme's categorical ramp, for the chart elements (docs/specs/009-elements/pie-chart.md). The
  // canvas hands its charts the same list; without it they fall back to the
  // built-in one, which is what a caller with no theme in hand wants.
  chartPalette?: readonly string[];
  // What each chart on a filled page sits on, by element id (chartPageGrounds): its series and text
  // are drawn adapted to it, as the canvas draws them (docs/specs/007-editor/pages-mode.md
  // "Charts adapt as they are drawn"). Absent, a chart is drawn in its colours as they are.
  chartGrounds?: ReadonlyMap<string, readonly string[]>;
  // A tab window's tab (docs/specs/009-elements/tab-window.md "Exports"): its drawing to fit inside, from a caller
  // that has the document's tabs (the editor's export); without one a window draws its frame named for its tab.
  resolveTabWindow?: ResolveTabWindow;
};

// The face a label paints in: the author's own choice, else the tab default. The
// same ladder the canvas walks — an export that resolved it differently
// would hand out a picture of a canvas nobody has.
// Under the Sketch finish an element without a face of its own writes in the handwriting font, whatever
// the tab's (docs/specs/008-canvas/finish.md).
export function exportFontFamily(
  el: BoxedElement,
  tabFont?: string,
  tabFinish?: Finish,
): string | undefined {
  return (
    resolveFontStack(el.font) ??
    resolveFontStack(elementFontId({ finish: finishOf(el) }, tabFont, tabFinish))
  );
}

/** An element's own finish, on the kinds that carry one. */
export function finishOf(el: object): Finish | undefined {
  const own = (el as { finish?: unknown }).finish;
  return isFinish(own) ? own : undefined;
}

// Every font id an export of these elements will paint with — what they
// chose and what the tab defaults to. The list a file's embedded (or declared) webfaces come
// from, so an export ships exactly the faces it uses.
export function exportFontIds(
  elements: readonly {
    type: string;
    font?: string;
    finish?: unknown;
    fillColor?: string;
  }[],
  tabFont?: string,
  tabFinish?: Finish,
): string[] {
  const boxed = elements.filter((el) => el.type !== 'arrow') as BoxedElement[];
  // What each element letters in when it has no face of its own: the handwriting font under Sketch.
  const finishFonts = elements.map((el) =>
    el.font ? undefined : elementFontId(el, undefined, tabFinish),
  );
  return fontIdsUsed(boxed, tabFont, finishFonts);
}

export function describeBoxedExport(
  source: BoxedElement,
  opts: BoxedExportOptions = {},
): BoxedExport {
  const surface = opts.surface ?? 'light';
  // A stock colour stored by name is drawn in its version for this page.
  const el = resolveStockColours(source, surface);
  const { resolveImageHref, resolveIconArt, resolveStickerArt } = opts;
  const fontFamily = exportFontFamily(el, opts.tabFont, opts.tabFinish);
  const opacity = el.opacity ?? 1;
  if (el.type === 'image') {
    // Mirror ImageElementView: borderRadius drives the corner clip (avatar
    // 'full' → circle), objectFit defaults to 'contain'.
    // Square by default under Professional (docs/specs/008-canvas/finish.md "Images").
    const radius = imageCornerPx(el, resolveFinish(undefined, opts.tabFinish));
    const objectFit = el.objectFit ?? 'contain';
    const href = el.imageId ? resolveImageHref?.(el.imageId) : undefined;
    return {
      opacity,
      shape: { kind: 'image', href, objectFit, radius },
      // Only paint the alt-text placeholder label when the bitmap ISN'T
      // embedded — an inlined image shouldn't have "Image" text over it.
      label: href
        ? null
        : {
            text: el.alt ?? 'Image',
            x: el.x + el.width / 2,
            y: el.y + el.height / 2,
            anchor: 'middle',
            valign: 'middle',
            maxWidth: labelMaxWidth(el),
            color: EXPORT_IMAGE_LABEL,
            size: 12,
            bold: true,
            italic: false,
            fontFamily,
          },
    };
  }
  // Stickers (docs/specs/010-palette/stickers.md) come before any colour work: the art is entirely
  // self-coloured and there is never a label, so a sticker is its plate and
  // nothing else.
  const stickerArt =
    el.type === 'shape' && el.shape === 'sticker' && el.stickerId
      ? resolveStickerArt?.(el.stickerId)
      : undefined;
  if (stickerArt) {
    return { opacity, shape: { kind: 'sticker', art: stickerArt }, label: null };
  }
  const own = {
    fill: 'fillColor' in el ? el.fillColor : undefined,
    stroke: 'strokeColor' in el ? el.strokeColor : undefined,
    text: 'textColor' in el ? el.textColor : undefined,
  };
  const fill = own.fill ?? defaultFillColor(el, surface);
  // A sticky is borderless paper unless the user deliberately set a border
  // colour (matching the canvas, docs/specs/008-canvas/canvas-and-palette.md "Sticky notes read as paper").
  const stroke = own.stroke ?? (el.type === 'sticky' ? 'none' : defaultStrokeColor(el, surface));
  // Icon elements (docs/specs/008-canvas/canvas-and-palette.md "Icons" line art + docs/specs/010-palette/technology-icons.md Technology marks): when
  // a caller supplies the glyph resolver AND the id resolves, export the real
  // art with the caption in the bottom band (mirroring IconGlyph /
  // TechIconGlyph's glyph-above-caption layout). Otherwise fall through to
  // the generic rect branch — the historical box-with-label output — so a
  // resolver-less caller renders exactly what it always did.
  const iconArt =
    el.type === 'shape' && el.shape === 'icon' && el.iconId
      ? resolveIconArt?.(el.iconId)
      : undefined;
  if (iconArt) {
    const size = fontSizeFor(el.textSize);
    // The caption lives in its own band — the complement of the glyph band
    // (iconCaptionBand, docs/specs/010-palette/technology-icons.md) — so it can never stack over the art: a
    // centre caption takes the vertical band the glyph doesn't, a left/right
    // caption its half of the box, centred on the glyph's row. Mirrors the
    // editor's captionBandClass exactly.
    const alignX = el.textAlignX ?? 'center';
    const band = iconCaptionBand(el);
    const labelY =
      band.valign === 'top'
        ? band.y + size
        : band.valign === 'bottom'
          ? band.y + band.height - size
          : band.y + band.height / 2;
    const labelX =
      alignX === 'left'
        ? band.x + 8
        : alignX === 'right'
          ? band.x + band.width - 8
          : band.x + band.width / 2;
    return {
      opacity,
      shape: { kind: 'icon', art: iconArt, fill, stroke },
      label: el.label
        ? {
            text: el.label,
            x: labelX,
            y: labelY,
            anchor: alignX === 'left' ? 'start' : alignX === 'right' ? 'end' : 'middle',
            // A multi-line caption stacks INTO its band from its anchored
            // edge — a bottom caption grows upward, not off the bottom of
            // the element; a side caption centres on the glyph's row.
            valign: band.valign,
            // Wraps at the caption band, so a long side caption breaks at
            // its half of the box instead of running under the glyph.
            maxWidth: Math.max(24, band.width - 16),
            color: el.textColor ?? defaultTextColor(el, surface),
            size,
            bold: !!el.textBold,
            italic: !!el.textItalic,
            fontFamily,
          }
        : null,
    };
  }
  const shape: ExportShape =
    el.type === 'shape' && el.shape === 'circle'
      ? { kind: 'ellipse', fill, stroke }
      : el.type === 'shape' && el.shape === 'diamond'
        ? { kind: 'diamond', fill, stroke }
        : el.type === 'text'
          ? { kind: 'none' }
          : { kind: 'rect', fill, stroke };
  // A badge or step number (docs/specs/009-elements/badge.md) writes in its look's text colour: the look decides
  // what the pill is filled with, so it decides what reads on it.
  const inkColor = own.text ?? defaultTextColor(el, surface);
  const baseColor =
    el.type === 'shape' && isChipShape(el.shape)
      ? chipColours(chipLookOf(el), { accent: stroke, surface: fill, ink: inkColor }).text
      : inkColor;
  // A sticky's label is a block of writing rather than a name, and runs
  // smaller at every preset. The canvas decides that the same way (its
  // `multiline` flag is `type === 'sticky'`).
  const multiline = el.type === 'sticky';
  // A Shift-resized text box draws its text scaled (docs/specs/006-document/document-structure.md "Data model").
  const textScale = el.type === 'text' ? (el.textScale ?? 1) : 1;
  const baseSize = fontSizeFor(el.textSize, multiline) * textScale;
  const richText = (el as { richText?: TextRun[] }).richText;
  const runs: ExportRun[] | undefined = hasRichFormatting(richText)
    ? richText!.map((run) => ({
        text: run.text,
        color: run.color ?? baseColor,
        size: run.size ? runFontPx(run.size, multiline) * textScale : baseSize,
        bold: run.bold ?? !!el.textBold,
        italic: run.italic ?? !!el.textItalic,
        ...(run.muted ? { muted: true } : {}),
      }))
    : undefined;
  // Mirror the editor's label layout: alignment defaults per element type
  // (sticky notes are top-left), the padding preset as the inset, and the
  // vertical anchor following textAlignY — a top-aligned label must
  // export at the box's top, not float at its vertical centre.
  const defaults = defaultTextAlign(el);
  const alignX = el.textAlignX ?? defaults.x;
  const alignY = el.textAlignY ?? defaults.y;
  const pad = PADDING_PX[el.padding ?? defaultPadding(el)];
  // A cylinder's label sits on its body, under the lid and over the base (labelBodyInset).
  const body = labelBodyInset(el);
  const bodyTop = el.y + body.top;
  const bodyBottom = el.y + el.height - body.bottom;
  const label: ExportLabel | null = el.label
    ? {
        text: el.label,
        x:
          alignX === 'right'
            ? el.x + el.width - pad
            : alignX === 'left'
              ? el.x + pad
              : el.x + el.width / 2,
        y:
          alignY === 'top'
            ? bodyTop + pad + baseSize / 2
            : alignY === 'bottom'
              ? bodyBottom - pad - baseSize / 2
              : (bodyTop + bodyBottom) / 2,
        anchor: alignX === 'right' ? 'end' : alignX === 'left' ? 'start' : 'middle',
        valign: alignY,
        maxWidth: labelMaxWidth(el, pad),
        color: baseColor,
        size: baseSize,
        bold: !!el.textBold,
        italic: !!el.textItalic,
        fontFamily,
        runs,
      }
    : null;
  return { opacity, shape, label };
}

// A shape that writes its own text, so no centred label is printed over it: a self-drawing shape
// (charts; the legend is its own case), a web component.
export function selfLabelled(el: BoxedElement): boolean {
  if (el.type !== 'shape') return false;
  return (
    (isSelfDrawingShape(el.shape) && el.shape !== 'legend') ||
    isWebComponentShape(el.shape) ||
    // A cycle and a hub write their centre label themselves (docs/specs/009-elements/concept-graphics.md).
    el.shape === 'cycle' ||
    el.shape === 'hub'
  );
}

// Whether an export prints the element's label as the ordinary centred, wrapped label: not a table,
// stroke, code block, legend or checklist (each draws its own), nor a self-labelled shape.
export function drawsStandardLabel(el: BoxedElement): boolean {
  if (el.type === 'table' || el.type === 'freehand') return false;
  if (
    el.type === 'shape' &&
    (el.shape === 'code-block' ||
      el.shape === 'legend' ||
      el.shape === 'checklist' ||
      el.shape === 'tab-window')
  )
    return false;
  return !selfLabelled(el);
}

// The room the ordinary label wraps in: the width it may run to and the height between its padding,
// exactly as `describeBoxedExport` lays the label out.
export function labelRoom(el: BoxedElement): { width: number; height: number } {
  const pad = PADDING_PX[el.padding ?? defaultPadding(el)];
  const body = labelBodyInset(el);
  const bodyTop = el.y + body.top;
  const bodyBottom = el.y + el.height - body.bottom;
  return { width: labelMaxWidth(el, pad), height: bodyBottom - pad - (bodyTop + pad) };
}
