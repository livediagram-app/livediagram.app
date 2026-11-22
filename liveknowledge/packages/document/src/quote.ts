// The quote (docs/specs/009-elements/quote.md): a pull quote or testimonial as one element. The words are its label;
// its source is a name (`pageTitle`), a role (`pageSubtitle`) and a portrait, a photo (`imageId`) or the name's initial
// (`cardMedia: 'initial'`). The layout is PURE so the canvas face and the headless renderer place every slot from the
// same numbers, and an export matches the editor.
//
// A LEAF module (types only from './index'), like card.ts.

import { clamp } from '@liveworkspace/model-core/geometry-primitives';
import type { Element, ShapeElement } from './index';
import type { LayoutRect } from './web-components';

export type QuoteLook = 'card' | 'plain';
export const QUOTE_LOOKS: readonly QuoteLook[] = ['card', 'plain'];
export type QuotePortrait = 'photo' | 'initial';
export const QUOTE_PORTRAITS: readonly QuotePortrait[] = ['initial', 'photo'];

/** The opening mark the quote draws; typed marks in the words are the writer's own. */
export const QUOTE_MARK = '“';

export function isQuoteLook(v: unknown): v is QuoteLook {
  return v === 'card' || v === 'plain';
}

/** A quote's look: its own, else the Card. */
export function quoteLookOf(el: ShapeElement): QuoteLook {
  return isQuoteLook(el.quoteLook) ? el.quoteLook : 'card';
}

/** A quote's portrait: a photo when it places one, else the initial when it asks for one, else none. */
export function quotePortraitOf(el: ShapeElement): QuotePortrait | null {
  if (typeof el.imageId === 'string' && el.imageId) return 'photo';
  return el.cardMedia === 'initial' ? 'initial' : null;
}

/** The letter an initial portrait draws: the name's first, or "?" with no name. */
export function quoteInitial(name: string | undefined): string {
  return ([...(name ?? '').trim()][0] ?? '?').toUpperCase();
}

// --- Layout ---------------------------------------------------------------------------------------------------

export type QuoteSlots = {
  look: QuoteLook;
  portrait: boolean;
  name: boolean;
  role: boolean;
  // The label's px, so a box too small for the words drops other slots first.
  labelPx: number;
};

export type QuoteLayout = {
  mark: LayoutRect | null;
  markPx: number;
  body: LayoutRect;
  portrait: LayoutRect | null;
  name: LayoutRect | null;
  role: LayoutRect | null;
  namePx: number;
  rolePx: number;
};

function layoutOnce(w: number, h: number, s: QuoteSlots, keep: Keep): QuoteLayout {
  const pad = s.look === 'card' ? clamp(Math.min(w, h) * 0.08, 12, 32) : 0;
  const x0 = pad;
  const y0 = pad;
  const iw = Math.max(0, w - pad * 2);
  const ih = Math.max(0, h - pad * 2);
  const markPx = Math.round(clamp(Math.min(h * 0.22, w * 0.16), 24, 120));
  const namePx = Math.round(clamp(h * 0.075, 12, 22));
  const rolePx = Math.round(namePx * 0.82);
  const nameH = namePx * 1.3;
  const roleH = rolePx * 1.3;
  const hasName = s.name;
  const hasRole = s.role && keep.role;
  const sourceH = (hasName ? nameH : 0) + (hasRole ? roleH : 0);
  const showPortrait = s.portrait && keep.portrait;
  const portraitD = showPortrait ? Math.max(namePx * 2, sourceH) : 0;
  const bandH = Math.max(sourceH, portraitD);
  const bandY = y0 + ih - bandH;
  const mark = keep.mark ? { x: x0, y: y0, width: markPx, height: markPx } : null;
  const portrait = showPortrait
    ? { x: x0, y: bandY + (bandH - portraitD) / 2, width: portraitD, height: portraitD }
    : null;
  const textX = portrait ? x0 + portraitD + portraitD * 0.3 : x0;
  const textW = Math.max(0, x0 + iw - textX);
  const linesTop = bandY + (bandH - sourceH) / 2;
  const name = hasName ? { x: textX, y: linesTop, width: textW, height: nameH } : null;
  const role = hasRole
    ? { x: textX, y: linesTop + (hasName ? nameH : 0), width: textW, height: roleH }
    : null;
  const bodyTop = mark ? mark.y + mark.height + 4 : y0;
  const bodyBottom = bandH > 0 ? bandY - namePx : y0 + ih;
  const body = { x: x0, y: bodyTop, width: iw, height: Math.max(0, bodyBottom - bodyTop) };
  return { mark, markPx, body, portrait, name, role, namePx, rolePx };
}

type Keep = { role: boolean; portrait: boolean; mark: boolean };

/** Every slot's rect, element-relative. A box too small for the words drops the role, then the portrait, then the
 *  quote mark, until the words have room for a line and a half; the words themselves never drop. */
export function quoteLayout(w: number, h: number, s: QuoteSlots): QuoteLayout {
  const minBody = Math.max(24, s.labelPx * 1.4);
  const steps: Keep[] = [
    { role: true, portrait: true, mark: true },
    { role: false, portrait: true, mark: true },
    { role: false, portrait: false, mark: true },
    { role: false, portrait: false, mark: false },
  ];
  let out = layoutOnce(w, h, s, steps[0]!);
  for (const keep of steps.slice(1)) {
    if (out.body.height >= minBody) break;
    out = layoutOnce(w, h, s, keep);
  }
  return out;
}

/** The slots a quote has on, for `quoteLayout`. */
export function quoteSlotsOf(el: ShapeElement, labelPx: number): QuoteSlots {
  return {
    look: quoteLookOf(el),
    portrait: quotePortraitOf(el) !== null,
    name: !!el.pageTitle,
    role: !!el.pageSubtitle,
    labelPx,
  };
}

// --- Writes ---------------------------------------------------------------------------------------------------

/** A quote in `look`; the Card is stored as nothing. */
export function withQuoteLook<T extends Element>(el: T, look: QuoteLook): T {
  if (el.type !== 'shape' || el.shape !== 'quote') return el;
  const next = { ...el } as T & { quoteLook?: QuoteLook };
  if (look === 'plain') next.quoteLook = 'plain';
  else delete next.quoteLook;
  return next;
}

/** A quote with no portrait, or the initial. The photo is set through the picture picker (it needs an image), so
 *  asking for `'photo'` here keeps a photo that is set and otherwise leaves the quote as it is. Choosing the initial
 *  or none removes a photo. */
export function withQuotePortrait<T extends Element>(el: T, portrait: QuotePortrait | null): T {
  if (el.type !== 'shape' || el.shape !== 'quote') return el;
  if (portrait === 'photo') return el;
  const next = { ...el } as T & { cardMedia?: string; imageId?: string };
  delete next.imageId;
  if (portrait === 'initial') next.cardMedia = 'initial';
  else delete next.cardMedia;
  return next;
}

/** Turn a quote's name or role line on (with a starting word to type over) or off. */
export function withQuoteLine<T extends Element>(
  el: T,
  field: 'pageTitle' | 'pageSubtitle',
  on: boolean,
): T {
  if (el.type !== 'shape' || el.shape !== 'quote') return el;
  const next = { ...el } as T & { pageTitle?: string; pageSubtitle?: string };
  if (on) next[field] = next[field] || (field === 'pageTitle' ? 'Name' : 'Role');
  else delete next[field];
  return next;
}
