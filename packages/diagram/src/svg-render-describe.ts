// The export descriptor layer of the headless SVG renderer (spec/62
// §5), split out of svg-render.ts: the export constants, the
// ExportShape / resolver types, and describeBoxedExport — the pure
// element -> shape + label descriptor both the per-element emitters and
// the in-app canvas drawer consume. The emitters stay in svg-render.ts.

import { BORDER_RADIUS_PX } from './border-style';
import {
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
} from './colors';
import { hasRichFormatting } from './rich-text';
import { iconCaptionBand } from './icon-size';
import { fontSizeFor, labelMaxWidth } from './svg-render-primitives';
import type { ExportLabel, ExportRun } from './svg-render-labels';
import { PADDING_PX } from './index';
import type { BoxedElement, TextRun } from './index';

export const EXPORT_PADDING = 32;
export const EXPORT_BG = '#ffffff';
export const EXPORT_IMAGE_FILL = '#f1f5f9'; // slate-100 placeholder body
export const EXPORT_IMAGE_STROKE = '#94a3b8'; // slate-400 placeholder dashes
export const EXPORT_IMAGE_LABEL = '#64748b'; // slate-500 alt-text label

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
// recoloured. Matches @livediagram/icons' IconExportArt structurally — kept
// structural so this package doesn't depend on the catalogue package; each
// caller supplies a resolver (the editor from its async icon registry, the
// Workers from @livediagram/icons/resolve). No resolver, or an unknown id,
// falls back to the pre-icon output: a plain box with the centred label.
export type ExportIconArt = { markup: string; colored: boolean };
export type ResolveIconArt = (iconId: string) => ExportIconArt | undefined;

export type BoxedExport = { opacity: number; shape: ExportShape; label: ExportLabel | null };

export function describeBoxedExport(
  el: BoxedElement,
  resolveImageHref?: ResolveImageHref,
  resolveIconArt?: ResolveIconArt,
): BoxedExport {
  const opacity = el.opacity ?? 1;
  if (el.type === 'image') {
    // Mirror ImageElementView: borderRadius drives the corner clip (avatar
    // 'full' → circle), objectFit defaults to 'contain'.
    const radius = el.borderRadius !== undefined ? BORDER_RADIUS_PX[el.borderRadius] : 4;
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
          },
    };
  }
  const fill = el.fillColor ?? defaultFillColor(el);
  const stroke = el.strokeColor ?? defaultStrokeColor(el);
  // Icon elements (spec/09 "Icons" line art + spec/41 Technology marks): when
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
    // (iconCaptionBand, spec/41) — so it can never stack over the art: a
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
            color: el.textColor ?? defaultTextColor(el),
            size,
            bold: !!el.textBold,
            italic: !!el.textItalic,
          }
        : null,
    };
  }
  const shape: ExportShape =
    (el.type === 'shape' && el.shape === 'circle') || el.type === 'annotation'
      ? { kind: 'ellipse', fill, stroke }
      : el.type === 'shape' && el.shape === 'diamond'
        ? { kind: 'diamond', fill, stroke }
        : el.type === 'text'
          ? { kind: 'none' }
          : { kind: 'rect', fill, stroke };
  const baseColor = el.textColor ?? defaultTextColor(el);
  const baseSize = fontSizeFor(el.textSize);
  const richText = (el as { richText?: TextRun[] }).richText;
  const runs: ExportRun[] | undefined = hasRichFormatting(richText)
    ? richText!.map((run) => ({
        text: run.text,
        color: run.color ?? baseColor,
        size: run.size ? fontSizeFor(run.size) : baseSize,
        bold: run.bold ?? !!el.textBold,
        italic: run.italic ?? !!el.textItalic,
      }))
    : undefined;
  // Mirror the editor's label layout: alignment defaults per element type
  // (sticky notes are top-left), the padding preset as the inset, and the
  // vertical anchor following textAlignY — a top-aligned frame label must
  // export at the frame's top, not float at its vertical centre.
  const defaults = defaultTextAlign(el);
  const alignX = el.textAlignX ?? defaults.x;
  const alignY = el.textAlignY ?? defaults.y;
  const pad = PADDING_PX[el.padding ?? defaultPadding(el)];
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
            ? el.y + pad + baseSize / 2
            : alignY === 'bottom'
              ? el.y + el.height - pad - baseSize / 2
              : el.y + el.height / 2,
        anchor: alignX === 'right' ? 'end' : alignX === 'left' ? 'start' : 'middle',
        valign: alignY,
        maxWidth: labelMaxWidth(el, pad),
        color: baseColor,
        size: baseSize,
        bold: !!el.textBold,
        italic: !!el.textItalic,
        runs,
      }
    : null;
  return { opacity, shape, label };
}
