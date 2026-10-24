// The card in the headless render (docs/specs/009-elements/card.md). The card's own box is the ordinary bordered
// rect svgBoxed draws; this is what sits in it, placed from the same cardLayout the canvas face uses.

import { capBandBaselineY } from '@liveworkspace/icons';
import { cardLayout, cardMediaOf, cardSlotsOf } from './card';
import { colorWash } from './color-wash';
import { borderOf } from './svg-render-border';
import { labelOn } from './readable-colour';
import { TAG_CHIP_WASH, tagColourOf } from './tag-colours';
import type { BoxedElement } from './index';
import { r2, svgIconGlyph as glyph, xmlEscape } from './svg-render-primitives';
import { label as webLabel, line as webLine, type WebFaceOptions } from './svg-render-web';
import { ACCENT_BAR_TEXT, type LayoutRect } from './web-components';

type Shape = BoxedElement & { type: 'shape' };

// A glyph from the icon catalogue drawn into `r` (element-relative): line art stroked in `colour`, a Technology mark
// as its own self-coloured tile.

const inset = (r: LayoutRect, share: number): LayoutRect => {
  const d = Math.min(r.width, r.height) * share;
  return { x: r.x + d, y: r.y + d, width: r.width - d * 2, height: r.height - d * 2 };
};

/** The card's slots, or '' for any other kind. */
export function svgCard(el: Shape, o: WebFaceOptions): string {
  const { stroke, label: text, fontFamily } = o;
  const ink = el.textColor ?? o.labelColor;
  const l = cardLayout(el.width, el.height, cardSlotsOf(el));
  const media = cardMediaOf(el);
  const art = el.iconId ? o.resolveIconArt?.(el.iconId) : undefined;
  let out = '';

  // The header band: the accent (or its own fill) across the top, clipped to the inside of the card's border so it
  // takes the card's top corners, as the canvas's overflow-hidden band does.
  let bandText = ink;
  if (l.band) {
    const bandFill = el.headerFill ?? stroke;
    bandText = el.headerFill ? labelOn(el.headerFill) : ACCENT_BAR_TEXT;
    const b = borderOf(el);
    const w = Math.max(0, el.width - b.width * 2);
    const h = Math.max(0, el.height - b.width * 2);
    const rx = Math.max(0, Math.min(b.radius - b.width, Math.min(w, h) / 2));
    const id = `lvd-cb-${el.id.replace(/[^A-Za-z0-9_-]/g, '')}`;
    out +=
      `<clipPath id="${id}"><rect x="${r2(el.x + b.width)}" y="${r2(el.y + b.width)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(rx)}"/></clipPath>` +
      `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(l.band.height)}"` +
      ` fill="${xmlEscape(bandFill)}" clip-path="url(#${id})"/>`;
  }

  if (l.media && media) {
    const m = l.media;
    // On the header band the accent is the ground, so the media takes the band's text colour instead.
    const stroke = l.band ? bandText : o.stroke;
    const badgeInk = l.band ? (el.headerFill ?? o.stroke) : ACCENT_BAR_TEXT;
    const cx = el.x + m.x + m.width / 2;
    const cy = el.y + m.y + m.height / 2;
    if (media === 'badge') {
      out += `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(m.width / 2)}" fill="${xmlEscape(stroke)}"/>`;
      out += art
        ? glyph(el, art, inset(m, 0.22), badgeInk)
        : webLine(el, 'i', m, Math.round(m.width / 2), badgeInk, {
            bold: true,
            fontFamily,
            onCapBand: true,
          });
    } else if (media === 'tile') {
      if (!art?.colored)
        out += `<rect x="${r2(el.x + m.x)}" y="${r2(el.y + m.y)}" width="${r2(m.width)}" height="${r2(m.height)}" rx="${r2(m.width * 0.24)}" fill="${xmlEscape(colorWash(stroke, 0.16))}"/>`;
      if (art) out += glyph(el, art, art.colored ? m : inset(m, 0.2), stroke);
    } else {
      const initial = ((el.pageTitle ?? '').trim()[0] ?? '?').toUpperCase();
      const px = Math.round(m.width * 0.42);
      out +=
        `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(m.width / 2)}" fill="${xmlEscape(colorWash(stroke, 0.16))}"/>` +
        `<text x="${r2(cx)}" y="${r2(capBandBaselineY(cy, px))}" text-anchor="middle"` +
        ` font-family="${xmlEscape(fontFamily ?? 'system-ui, sans-serif')}" font-size="${px}" font-weight="700"` +
        ` fill="${xmlEscape(stroke)}">${xmlEscape(initial)}</text>`;
    }
  }

  if (l.title)
    out += webLine(el, el.pageTitle ?? '', l.title, l.titlePx, bandText, {
      align: 'start',
      bold: true,
      fontFamily,
    });
  if (l.meta)
    out += webLine(el, el.pageSubtitle ?? '', l.meta, l.metaPx, bandText, {
      align: l.band ? 'end' : 'start',
      opacity: 0.7,
      fontFamily,
    });

  out += webLabel(el, text, l.body, ink, fontFamily);

  for (const t of l.tags) {
    // A mapped tag's chip in its colour (docs/specs/009-elements/tag-colours.md), as the canvas tints it.
    const tagged = tagColourOf(o.tagColours, t.text);
    const wash = tagged ? colorWash(tagged, TAG_CHIP_WASH) : colorWash(stroke, 0.1);
    out +=
      `<rect x="${r2(el.x + t.rect.x)}" y="${r2(el.y + t.rect.y)}" width="${r2(t.rect.width)}" height="${r2(t.rect.height)}"` +
      ` rx="${r2(t.rect.height / 2)}" fill="${xmlEscape(wash)}"` +
      ` stroke="${xmlEscape(tagged ?? colorWash(stroke, 0.35))}" stroke-width="1"/>` +
      webLine(el, t.text, t.rect, l.tagPx, tagged ?? ink, {
        fontFamily,
        opacity: tagged ? 1 : 0.85,
      });
  }
  return out;
}
