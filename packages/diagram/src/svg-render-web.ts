// The web components in the headless render (spec/146): banner, callout, stat
// row, process steps, header, and an image's hero caption card.
//
// Geometry comes from web-components.ts, the same pure layouts the canvas
// views position from, so an export lands every card, circle and link where
// the editor drew it. The label is drawn here in its region rather than by
// the generic centred label, which would print it over the whole box.

import { BORDER_RADIUS_PX } from './border-style';
import { labelFontPx } from './label-font';
import type { BoxedElement, ImageElement } from './index';
import { svgWrappedLabel } from './svg-render-labels';
import { labelMeasure, r2, wrapLabel, xmlEscape } from './svg-render-primitives';
import {
  ACCENT_BAR_TEXT,
  bannerLayout,
  calloutLayout,
  headerLayout,
  heroCaptionLayout,
  processLayout,
  statRowLayout,
  type LayoutRect,
} from './web-components';

type Shape = BoxedElement & { type: 'shape' };

const family = (fontFamily?: string) =>
  ` font-family="${xmlEscape(fontFamily ?? 'system-ui, sans-serif')}"`;

// One line of text centred vertically in `r` (element-relative), anchored per
// `align`. Clipped by character count, since a headless render cannot measure.
function line(
  el: BoxedElement,
  text: string,
  r: LayoutRect,
  px: number,
  color: string,
  o: { align?: 'start' | 'middle' | 'end'; bold?: boolean; opacity?: number; fontFamily?: string },
): string {
  if (!text) return '';
  const align = o.align ?? 'middle';
  const x = el.x + (align === 'start' ? r.x : align === 'end' ? r.x + r.width : r.x + r.width / 2);
  const maxChars = Math.max(1, Math.floor(r.width / (px * 0.56)));
  const shown = text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
  return (
    `<text x="${r2(x)}" y="${r2(el.y + r.y + r.height / 2)}" text-anchor="${align}" dominant-baseline="central"` +
    `${family(o.fontFamily)} font-size="${px}" font-weight="${o.bold ? 600 : 400}"` +
    (o.opacity !== undefined ? ` opacity="${o.opacity}"` : '') +
    ` fill="${xmlEscape(color)}">${xmlEscape(shown)}</text>`
  );
}

// The element's label, wrapped into `r` with its own size / weight / alignment.
function label(el: Shape, text: string, r: LayoutRect, color: string, fontFamily?: string): string {
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

const radiusOf = (el: Shape, fallback: number) =>
  el.borderRadius !== undefined ? BORDER_RADIUS_PX[el.borderRadius] : fallback;

/** The body of a web component shape, or '' for any other kind. */
export function svgWebComponent(
  el: Shape,
  o: { stroke: string; fill: string; labelColor: string; label: string; fontFamily?: string },
): string {
  const { stroke, fill, label: text, fontFamily } = o;
  const ink = el.textColor ?? o.labelColor;
  const whole: LayoutRect = { x: 0, y: 0, width: el.width, height: el.height };
  switch (el.shape) {
    case 'banner': {
      const bar = el.fillColor ?? stroke;
      const white = el.textColor ?? ACCENT_BAR_TEXT;
      const l = bannerLayout(el.width, el.height);
      return (
        rect(el, whole, radiusOf(el, 12), `fill="${xmlEscape(bar)}"`) +
        label(el, text, l.title, white, fontFamily) +
        line(el, el.pageSubtitle ?? '', l.subtitle, l.subtitlePx, white, {
          opacity: 0.85,
          fontFamily,
        })
      );
    }
    case 'callout': {
      // The card itself is the ordinary box svgBoxed draws; this is what
      // sits in it.
      const l = calloutLayout(el.width, el.height);
      return (
        `<circle cx="${r2(el.x + l.badge.cx)}" cy="${r2(el.y + l.badge.cy)}" r="${r2(l.badge.r)}" fill="${xmlEscape(stroke)}"/>` +
        line(
          el,
          'i',
          {
            x: l.badge.cx - l.badge.r,
            y: l.badge.cy - l.badge.r,
            width: l.badge.r * 2,
            height: l.badge.r * 2,
          },
          Math.round(l.badge.r),
          ACCENT_BAR_TEXT,
          { bold: true, fontFamily },
        ) +
        line(el, el.pageTitle ?? '', l.heading, l.headingPx, ink, {
          align: 'start',
          bold: true,
          fontFamily,
        }) +
        label(el, text, l.body, ink, fontFamily)
      );
    }
    case 'stat-row': {
      const stats = el.stats ?? [];
      const l = statRowLayout(el.width, el.height, stats.length);
      const rx = radiusOf(el, 8);
      return stats
        .map((st, i) => {
          const c = l.cards[i]!;
          const valueBand = { ...c, y: c.height * 0.12, height: c.height * 0.5 };
          const captionBand = { ...c, y: c.height * 0.58, height: c.height * 0.3 };
          return (
            rect(
              el,
              c,
              rx,
              `fill="${xmlEscape(fill)}" stroke="${xmlEscape(stroke)}" stroke-width="1"`,
            ) +
            line(el, st.value, valueBand, l.valuePx, stroke, { bold: true, fontFamily }) +
            line(el, st.caption, captionBand, l.captionPx, ink, { opacity: 0.7, fontFamily })
          );
        })
        .join('');
    }
    case 'process': {
      const steps = el.processSteps ?? [];
      const l = processLayout(el.width, el.height, steps.length);
      const connectors = l.connectors
        .map((c) => {
          const head = Math.min(7, (c.x2 - c.x1) / 2);
          if (c.x2 - c.x1 < 4) return '';
          const y = el.y + c.y;
          return (
            `<path d="M ${r2(el.x + c.x1)} ${r2(y)} L ${r2(el.x + c.x2 - head)} ${r2(y)}" stroke="${xmlEscape(stroke)}" stroke-width="2"/>` +
            `<path d="M ${r2(el.x + c.x2 - head)} ${r2(y - head * 0.7)} L ${r2(el.x + c.x2)} ${r2(y)} L ${r2(el.x + c.x2 - head)} ${r2(y + head * 0.7)} Z" fill="${xmlEscape(stroke)}"/>`
          );
        })
        .join('');
      const circles = l.steps
        .map((s, i) => {
          const num = { x: s.cx - s.r, y: s.cy - s.r, width: s.r * 2, height: s.r * 2 };
          return (
            `<circle cx="${r2(el.x + s.cx)}" cy="${r2(el.y + s.cy)}" r="${r2(s.r)}" fill="${xmlEscape(stroke)}"/>` +
            line(el, String(i + 1), num, l.numberPx, ACCENT_BAR_TEXT, { bold: true, fontFamily }) +
            line(el, steps[i] ?? '', s.caption, l.captionPx, ink, { fontFamily })
          );
        })
        .join('');
      return connectors + circles;
    }
    case 'site-header': {
      const bar = el.fillColor ?? stroke;
      const white = el.textColor ?? ACCENT_BAR_TEXT;
      const l = headerLayout(el.width, el.height, el.navLinks ?? []);
      const monogram = (text.trim()[0] ?? '').toUpperCase();
      return (
        rect(el, whole, radiusOf(el, 8), `fill="${xmlEscape(bar)}"`) +
        `<circle cx="${r2(el.x + l.logo.cx)}" cy="${r2(el.y + l.logo.cy)}" r="${r2(l.logo.r)}" fill="${xmlEscape(white)}" opacity="0.9"/>` +
        line(
          el,
          monogram,
          {
            x: l.logo.cx - l.logo.r,
            y: l.logo.cy - l.logo.r,
            width: l.logo.r * 2,
            height: l.logo.r * 2,
          },
          Math.round(l.logo.r),
          bar,
          { bold: true, fontFamily },
        ) +
        label(el, text, l.brand, white, fontFamily) +
        l.links
          .map((k) => line(el, k.text, k.rect, l.linkPx, white, { opacity: 0.9, fontFamily }))
          .join('')
      );
    }
    default:
      return '';
  }
}

/** An image's hero caption card (spec/146), drawn over the image. */
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
