// The card (docs/specs/009-elements/card.md): one diagram node with slots you switch on (a header band, media, a
// title, a meta line, the body label, tags). The layout is PURE so the canvas face and the headless renderer place
// every slot from the same numbers, and an export matches the editor.
//
// A LEAF module (types only from './index'), like web-components.ts, so the validator and the shape factory can read
// its constants at module-init time without walking the index cycle.

import { clamp } from './geometry-primitives';
import type { Element, IconPosition, ShapeElement } from './index';
import type { LayoutRect } from './web-components';

export type CardMedia = 'badge' | 'tile' | 'initial';
export const CARD_MEDIA: readonly CardMedia[] = ['badge', 'tile', 'initial'];

export const CARD_TAGS_MAX = 6;
export const CARD_TAG_MAX = 32;

export function isCardMedia(v: unknown): v is CardMedia {
  return v === 'badge' || v === 'tile' || v === 'initial';
}

/** Trim + bound a tag the way every write path should. */
export function clampCardTag(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, CARD_TAG_MAX);
}

// --- Layout ---------------------------------------------------------------------------------------

export type CardSlots = {
  header: boolean;
  media: boolean;
  title: boolean;
  meta: boolean;
  // Badge media lines the body up under the title, as the Callout did; the other media sit above a full-width body.
  badge: boolean;
  tags: readonly string[];
};

export type CardLayout = {
  band: LayoutRect | null;
  media: LayoutRect | null;
  title: LayoutRect | null;
  meta: LayoutRect | null;
  body: LayoutRect;
  tags: { text: string; rect: LayoutRect }[];
  titlePx: number;
  metaPx: number;
  tagPx: number;
};

const CARD_GAP = 6;
const TAG_GAP = 4;

/** A tag chip's width from its character count (no DOM headless; the canvas positions from the same number). */
export function cardTagWidth(text: string, tagPx: number): number {
  return Math.ceil(text.length * tagPx * 0.6) + Math.round(tagPx * 1.6);
}

/** The slots a card has switched on, read off the element. */
export function cardSlotsOf(el: ShapeElement): CardSlots {
  // A callout not yet migrated draws as the badge card it becomes.
  const media = el.shape === 'callout' ? 'badge' : el.cardMedia;
  return {
    header: el.cardHeader === true,
    media: isCardMedia(media),
    title: !!el.pageTitle,
    meta: !!el.pageSubtitle,
    badge: media === 'badge',
    tags: el.tags ?? [],
  };
}

/** The media a card draws, with a callout not yet migrated reading as a badge. */
export function cardMediaOf(el: ShapeElement): CardMedia | null {
  const media = el.shape === 'callout' ? 'badge' : el.cardMedia;
  return isCardMedia(media) ? media : null;
}

function layoutOnce(w: number, h: number, s: CardSlots): CardLayout {
  const pad = Math.round(clamp(Math.min(w, h) * 0.1, 10, 18));
  const titlePx = Math.round(clamp(h * 0.12, 12, 17));
  const metaPx = Math.round(clamp(titlePx * 0.8, 10, 13));
  const tagH = Math.round(clamp(h * 0.16, 18, 22));
  const tagPx = Math.round(tagH * 0.5);
  const right = w - pad;

  // Tags: one row along the bottom, filled from the left; a chip that would pass the right edge, and every chip
  // after it, is not placed.
  const tags: { text: string; rect: LayoutRect }[] = [];
  if (s.tags.length > 0) {
    let x = pad;
    for (const text of s.tags) {
      const width = cardTagWidth(text, tagPx);
      if (x + width > right) break;
      tags.push({ text, rect: { x, y: h - pad - tagH, width, height: tagH } });
      x += width + TAG_GAP;
    }
  }
  const bodyBottom = s.tags.length > 0 ? h - pad - tagH - CARD_GAP : h - pad;

  let band: LayoutRect | null = null;
  let media: LayoutRect | null = null;
  let title: LayoutRect | null = null;
  let meta: LayoutRect | null = null;
  let bodyTop: number;
  let bodyX = pad;

  if (s.header) {
    const bandH = Math.round(titlePx * 2.3);
    band = { x: 0, y: 0, width: w, height: bandH };
    let textX = pad;
    if (s.media) {
      const m = Math.max(0, bandH - 10);
      media = { x: pad, y: 5, width: m, height: m };
      textX = pad + m + 8;
    }
    let titleRight = right;
    if (s.meta) {
      const metaW = Math.min(
        (w - pad * 2) * 0.45,
        Math.ceil(metaPx * 0.56 * 24) + metaPx, // room for about two dozen characters
      );
      meta = { x: right - metaW, y: 0, width: metaW, height: bandH };
      titleRight = right - metaW - 8;
    }
    if (s.title) title = { x: textX, y: 0, width: Math.max(0, titleRight - textX), height: bandH };
    bodyTop = bandH + CARD_GAP + 2;
  } else {
    const m = Math.round(clamp(Math.min(w, h) * 0.3, 24, 44));
    let textX = pad;
    if (s.media) {
      media = { x: pad, y: pad, width: m, height: m };
      textX = pad + m + 10;
    }
    const textW = Math.max(0, right - textX);
    const titleH = s.title ? Math.round(titlePx * 1.35) : 0;
    const metaH = s.meta ? Math.round(metaPx * 1.4) : 0;
    if (s.title) title = { x: textX, y: pad, width: textW, height: titleH };
    if (s.meta) meta = { x: textX, y: pad + titleH, width: textW, height: metaH };
    // A badge sits beside the title and the body follows the title's column (the Callout); a tile or an initial
    // sits above a full-width body.
    if (s.badge && s.media) {
      bodyX = textX;
      bodyTop = pad + Math.max(titleH + metaH, 0) + (titleH + metaH > 0 ? 2 : 0);
    } else {
      const top = Math.max(s.media ? m : 0, titleH + metaH);
      bodyTop = pad + top + (top > 0 ? CARD_GAP : 0);
    }
  }

  const body = {
    x: bodyX,
    y: bodyTop,
    width: Math.max(0, right - bodyX),
    height: Math.max(0, bodyBottom - bodyTop),
  };
  return { band, media, title, meta, body, tags, titlePx, metaPx, tagPx };
}

/**
 * Every slot's rect, element-relative, for a card of `width` × `height` with `slots` on. A card too small for its
 * slots drops them in the order tags, meta line, media until its body has room for a line.
 */
export function cardLayout(width: number, height: number, slots: CardSlots): CardLayout {
  let s = slots;
  let l = layoutOnce(width, height, s);
  const minBody = Math.max(14, l.titlePx);
  const drops: ((x: CardSlots) => CardSlots)[] = [
    (x) => ({ ...x, tags: [] }),
    (x) => ({ ...x, meta: false }),
    (x) => ({ ...x, media: false }),
  ];
  for (const drop of drops) {
    if (l.body.height >= minBody) break;
    s = drop(s);
    l = layoutOnce(width, height, s);
  }
  return l;
}

// --- Writes ---------------------------------------------------------------------------------------

/** Set (or clear, with `null`) a card's media; any other element comes back unchanged. */
export function withCardMedia<T extends Element>(el: T, media: CardMedia | null): T {
  if (el.type !== 'shape' || el.shape !== 'card') return el;
  const next = { ...el } as T & { cardMedia?: CardMedia };
  if (media) next.cardMedia = media;
  else delete next.cardMedia;
  return next;
}

/** Turn a card's header band on or off; stored only when on. */
export function withCardHeader<T extends Element>(el: T, on: boolean): T {
  if (el.type !== 'shape' || el.shape !== 'card') return el;
  const next = { ...el } as T & { cardHeader?: boolean };
  if (on) next.cardHeader = true;
  else delete next.cardHeader;
  return next;
}

// --- The Callout ----------------------------------------------------------------------------------

/**
 * A stored callout becomes the card it always was (docs/specs/009-elements/card.md "The Callout is a Card preset"):
 * badge media, its heading as the title, its body as the label, every other field kept. Returns the same array when
 * there is nothing to migrate.
 */
export function migrateLegacyCallouts(elements: Element[]): Element[] {
  if (!elements.some(isLegacyCallout)) return elements;
  return elements.map((el) =>
    isLegacyCallout(el) ? ({ ...el, shape: 'card', cardMedia: 'badge' } as Element) : el,
  );
}

function isLegacyCallout(el: Element): boolean {
  return el.type === 'shape' && el.shape === 'callout';
}

/** The starting words a card line takes when it is switched on from the menu. */
export const CARD_LINE_DEFAULT: Record<'pageTitle' | 'pageSubtitle', string> = {
  pageTitle: 'Title',
  pageSubtitle: 'Meta line',
};

/** Switch a card's title or meta line on (with its starting words, keeping any it has) or off. */
export function withCardLine<T extends Element>(
  el: T,
  field: 'pageTitle' | 'pageSubtitle',
  on: boolean,
): T {
  if (el.type !== 'shape' || el.shape !== 'card') return el;
  const next = { ...el } as T & Record<'pageTitle' | 'pageSubtitle', string | undefined>;
  if (on) next[field] = next[field] || CARD_LINE_DEFAULT[field];
  else delete next[field];
  return next;
}

/** An inline icon set on a shape (dropped, picked or folded in). A card with no media takes it as a Tile, so the
 *  glyph shows (docs/specs/009-elements/card.md "The slots"); every other shape just carries it. */
export function withInlineIcon<T extends Element>(
  el: T,
  iconId: string,
  position?: IconPosition,
): T {
  if (el.type !== 'shape') return el;
  const next = { ...el, iconId, ...(position ? { iconPosition: position } : {}) } as T & {
    cardMedia?: CardMedia;
  };
  if (next.type === 'shape' && next.shape === 'card' && !isCardMedia(next.cardMedia))
    next.cardMedia = 'tile';
  return next;
}
