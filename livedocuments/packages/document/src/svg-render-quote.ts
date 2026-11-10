// The quote in the headless render (docs/specs/009-elements/quote.md): its card (in the Card look), quote mark, words,
// portrait and source, placed from the same quoteLayout the canvas face uses. The quote paints its own surface (it is
// self-painting), so a Plain quote draws no box at all.

import { BORDER_RADIUS_PX, cornerRadiusPx } from '@liveworkspace/model-core/border-style';
import { colorWash } from '@liveworkspace/model-core/color-wash';
import { labelFontPx } from '@liveworkspace/model-core/label-font';
import type { BoxedElement } from './index';
import {
  QUOTE_MARK,
  quoteInitial,
  quoteLayout,
  quoteLookOf,
  quotePortraitOf,
  quoteSlotsOf,
} from './quote';
import { r2, xmlEscape } from './svg-render-primitives';
import { label as webLabel, line as webLine, type WebFaceOptions } from './svg-render-web';

type Shape = BoxedElement & { type: 'shape' };

/** The quote's face, or '' for any other kind. */
export function svgQuote(el: Shape, o: WebFaceOptions): string {
  if (el.shape !== 'quote') return '';
  const { stroke, fill, label: text, fontFamily } = o;
  const ink = el.textColor ?? o.labelColor;
  const l = quoteLayout(el.width, el.height, quoteSlotsOf(el, labelFontPx(el.textSize)));
  let out = '';
  if (quoteLookOf(el) === 'card') {
    const rx = cornerRadiusPx(el.borderRadius, el.width, el.height, BORDER_RADIUS_PX.lg);
    out +=
      `<rect x="${r2(el.x + 0.5)}" y="${r2(el.y + 0.5)}" width="${r2(Math.max(0, el.width - 1))}"` +
      ` height="${r2(Math.max(0, el.height - 1))}" rx="${r2(rx)}" fill="${xmlEscape(fill)}"` +
      ` stroke="${xmlEscape(stroke)}" stroke-width="1"/>`;
  }
  if (l.mark) {
    // The mark's ink sits in the top of its em box, so it is drawn larger than its square and hung from the top.
    const px = l.markPx * 1.6;
    out +=
      `<text x="${r2(el.x + l.mark.x)}" y="${r2(el.y + l.mark.y + px * 0.72)}" font-size="${r2(px)}"` +
      ` font-family="Georgia, 'Times New Roman', serif" font-weight="700" fill="${xmlEscape(stroke)}">${QUOTE_MARK}</text>`;
  }
  out += webLabel(el, text, l.body, ink, fontFamily);
  if (l.portrait) {
    const p = l.portrait;
    const cx = el.x + p.x + p.width / 2;
    const cy = el.y + p.y + p.height / 2;
    const rad = p.width / 2;
    const href =
      quotePortraitOf(el) === 'photo' && el.imageId
        ? el.imageId.startsWith('data:')
          ? el.imageId
          : o.resolveImageHref?.(el.imageId)
        : undefined;
    if (href) {
      const id = `lvd-qp-${el.id.replace(/[^A-Za-z0-9_-]/g, '')}`;
      out +=
        `<clipPath id="${id}"><circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rad)}"/></clipPath>` +
        `<image href="${xmlEscape(href)}" x="${r2(el.x + p.x)}" y="${r2(el.y + p.y)}" width="${r2(p.width)}"` +
        ` height="${r2(p.height)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
    } else {
      // The initial, and the photo's stand-in when its bytes are not to hand.
      out +=
        `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(rad)}" fill="${xmlEscape(colorWash(stroke, 0.16))}"/>` +
        webLine(el, quoteInitial(el.pageTitle), p, Math.round(p.width * 0.42), stroke, {
          bold: true,
          fontFamily,
          onCapBand: true,
        });
    }
  }
  if (l.name)
    out += webLine(el, el.pageTitle ?? '', l.name, l.namePx, ink, {
      align: 'start',
      bold: true,
      fontFamily,
    });
  if (l.role)
    out += webLine(el, el.pageSubtitle ?? '', l.role, l.rolePx, ink, {
      align: 'start',
      opacity: 0.7,
      fontFamily,
    });
  return out;
}
