// The web components in the headless render (docs/specs/009-elements/web-components-and-no-groups.md): the card, the
// callout, and an image's hero caption card.
//
// Geometry comes from web-components.ts, the same pure layouts the canvas
// views position from, so an export lands every card, circle and link where
// the editor drew it. The label is drawn here in its region rather than by
// the generic centred label, which would print it over the whole box.

import { capBandBaselineY } from '@liveworkspace/icons';
import { labelFontPx } from '@liveworkspace/model-core/label-font';
import type { BoxedElement, ImageElement } from './index';
import { svgWrappedLabel } from './svg-render-labels';
import { svgCard } from './svg-render-card';
import type { TagColour } from './tag-colours';
import type { ResolveIconArt } from './svg-render-describe';
import { labelMeasure, r2, wrapLabel, xmlEscape } from './svg-render-primitives';
import { ACCENT_BAR_TEXT, heroCaptionLayout, type LayoutRect } from './web-components';

type Shape = BoxedElement & { type: 'shape' };

const family = (fontFamily?: string) =>
  ` font-family="${xmlEscape(fontFamily ?? 'system-ui, sans-serif')}"`;

// One line of text centred vertically in `r` (element-relative), anchored per
// `align`. Clipped by character count, since a headless render cannot measure.
// `onCapBand`: a glyph in a disc sits on the alphabetic baseline that centres its cap band
// (docs/specs/004-interface-design/optical-alignment.md); other lines centre their em box.
// How many characters a one-line slot `width` wide holds at `px`: past it, a line is cut with an ellipsis. The diagram
// lint reads the same count, so it warns of exactly the lines a render cuts.
export function lineChars(width: number, px: number): number {
  return Math.max(1, Math.floor(width / (px * 0.56)));
}

export function line(
  el: BoxedElement,
  text: string,
  r: LayoutRect,
  px: number,
  color: string,
  o: {
    align?: 'start' | 'middle' | 'end';
    bold?: boolean;
    opacity?: number;
    fontFamily?: string;
    onCapBand?: boolean;
  },
): string {
  if (!text) return '';
  const align = o.align ?? 'middle';
  const x = el.x + (align === 'start' ? r.x : align === 'end' ? r.x + r.width : r.x + r.width / 2);
  const maxChars = lineChars(r.width, px);
  const shown = text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
  return (
    (o.onCapBand
      ? `<text x="${r2(x)}" y="${r2(capBandBaselineY(el.y + r.y + r.height / 2, px))}" text-anchor="${align}"`
      : `<text x="${r2(x)}" y="${r2(el.y + r.y + r.height / 2)}" text-anchor="${align}" dominant-baseline="central"`) +
    `${family(o.fontFamily)} font-size="${px}" font-weight="${o.bold ? 600 : 400}"` +
    (o.opacity !== undefined ? ` opacity="${o.opacity}"` : '') +
    ` fill="${xmlEscape(color)}">${xmlEscape(shown)}</text>`
  );
}

// The element's label, wrapped into `r` with its own size / weight / alignment.
export function label(
  el: Shape,
  text: string,
  r: LayoutRect,
  color: string,
  fontFamily?: string,
): string {
  if (!text) return '';
  const px = labelFontPx(el.textSize);
  const bold = !!el.textBold;
  const italic = !!el.textItalic;
  const lines = wrapLabel(text, r.width, labelMeasure(px, bold, italic, fontFamily));
  const alignX = el.textAlignX ?? 'center';
  const alignY = el.textAlignY ?? 'middle';
  const anchor = alignX === 'left' ? 'start' : alignX === 'right' ? 'end' : 'middle';
  const x =
    el.x + (alignX === 'left' ? r.x : alignX === 'right' ? r.x + r.width : r.x + r.width / 2);
  const y =
    el.y +
    (alignY === 'top'
      ? r.y + px * 0.6
      : alignY === 'bottom'
        ? r.y + r.height - px * 0.6
        : r.y + r.height / 2);
  return svgWrappedLabel(lines, x, y, anchor, color, px, bold, italic, alignY, fontFamily);
}

const rect = (el: BoxedElement, r: LayoutRect, rx: number, attrs: string) =>
  `<rect x="${r2(el.x + r.x)}" y="${r2(el.y + r.y)}" width="${r2(r.width)}" height="${r2(r.height)}" rx="${r2(Math.min(rx, r.width / 2, r.height / 2))}" ${attrs}/>`;

/** What a web component's face (a card's among them) is drawn with: the element's resolved ink and label. */
export type WebFaceOptions = {
  stroke: string;
  fill: string;
  labelColor: string;
  label: string;
  fontFamily?: string;
  resolveIconArt?: ResolveIconArt;
  // The tab's tag colours (docs/specs/009-elements/tag-colours.md), for a card's tinted tag chips.
  tagColours?: readonly TagColour[];
};

/** The body of a web component shape, or '' for any other kind. */
export function svgWebComponent(el: Shape, o: WebFaceOptions): string {
  switch (el.shape) {
    // A callout not yet migrated draws as the badge card it becomes (docs/specs/009-elements/card.md).
    case 'callout':
    case 'card':
      return svgCard(el, o);
    default:
      return '';
  }
}

/** An image's hero caption card (docs/specs/009-elements/web-components-and-no-groups.md), drawn over the image. */
export function svgHeroCaption(el: ImageElement, fontFamily?: string): string {
  const cap = el.heroCaption;
  if (!cap) return '';
  const l = heroCaptionLayout(el.width, el.height);
  const card = el.fillColor ?? '#0f172a';
  const text = el.textColor ?? ACCENT_BAR_TEXT;
  return (
    rect(el, l.card, 12, `fill="${xmlEscape(card)}" opacity="0.82"`) +
    line(el, cap.title, l.title, l.titlePx, text, { bold: true, fontFamily }) +
    line(el, cap.subtitle, l.subtitle, l.subtitlePx, text, { opacity: 0.92, fontFamily })
  );
}
