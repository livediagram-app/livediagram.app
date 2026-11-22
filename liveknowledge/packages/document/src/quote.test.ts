import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { applyShapeVariant } from './shape-variants';
import {
  QUOTE_MARK,
  quoteInitial,
  quoteLayout,
  quoteLookOf,
  quotePortraitOf,
  quoteSlotsOf,
  withQuoteLine,
  withQuoteLook,
  withQuotePortrait,
} from './quote';
import { isValidElement } from './validate';
import type { LayoutRect } from './web-components';

// docs/specs/009-elements/quote.md.
const quote = () => createShape('quote', 0, 0);
const inside = (r: LayoutRect, w: number, h: number) =>
  r.x >= 0 && r.y >= 0 && r.x + r.width <= w + 0.01 && r.y + r.height <= h + 0.01;
const overlaps = (a: LayoutRect, b: LayoutRect) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 &&
  Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;

describe('the quote element', () => {
  it('starts as a Card testimonial with an initial, a name and a role, and validates', () => {
    const q = quote();
    expect(q).toMatchObject({ shape: 'quote', width: 460, height: 220, cardMedia: 'initial' });
    expect(quoteLookOf(q)).toBe('card');
    expect(quotePortraitOf(q)).toBe('initial');
    expect(q.pageTitle && q.pageSubtitle && q.label).toBeTruthy();
    expect(isValidElement(q)).toBe(true);
  });

  it('the Pull Quote preset is Plain, signed by a name alone', () => {
    const p = applyShapeVariant(quote(), 'pull');
    expect(p).toMatchObject({
      quoteLook: 'plain',
      width: 520,
      height: 180,
      pageTitle: 'Alex Morgan',
    });
    expect(p.pageSubtitle).toBeUndefined();
    expect(quotePortraitOf(p)).toBeNull();
    expect(isValidElement(p)).toBe(true);
  });

  it('refuses a look off its list and an empty photo id', () => {
    expect(isValidElement({ ...quote(), quoteLook: 'fancy' })).toBe(false);
    expect(isValidElement({ ...quote(), imageId: '' })).toBe(false);
    expect(isValidElement({ ...quote(), imageId: 'img-1' })).toBe(true);
  });

  it('reads a photo before the initial, and the initial from the name', () => {
    expect(quotePortraitOf({ ...quote(), imageId: 'img-1' })).toBe('photo');
    expect(quotePortraitOf({ ...quote(), cardMedia: undefined })).toBeNull();
    expect(quoteInitial('sam Rivera')).toBe('S');
    expect(quoteInitial('  ')).toBe('?');
    expect(quoteInitial(undefined)).toBe('?');
    expect(quoteInitial('Émile')).toBe('É');
    expect(QUOTE_MARK).toBe('“');
  });
});

describe('quote writes', () => {
  it('stores the Card as nothing and the Plain as itself', () => {
    const plain = withQuoteLook(quote(), 'plain');
    expect(plain.quoteLook).toBe('plain');
    expect('quoteLook' in withQuoteLook(plain, 'card')).toBe(false);
  });

  it('sets the initial or none, which drop a photo; Photo leaves the quote as it is', () => {
    const withPhoto = { ...quote(), imageId: 'img-1' };
    expect(withQuotePortrait(withPhoto, 'photo')).toBe(withPhoto);
    const initial = withQuotePortrait(withPhoto, 'initial');
    expect(initial.imageId).toBeUndefined();
    expect(initial.cardMedia).toBe('initial');
    const none = withQuotePortrait(withPhoto, null);
    expect('imageId' in none || 'cardMedia' in none).toBe(false);
  });

  it('turns the name and role lines on with a word to type over, and off', () => {
    const off = withQuoteLine(quote(), 'pageSubtitle', false);
    expect('pageSubtitle' in off).toBe(false);
    expect(withQuoteLine(off, 'pageSubtitle', true).pageSubtitle).toBe('Role');
    expect(withQuoteLine(withQuoteLine(off, 'pageTitle', false), 'pageTitle', true).pageTitle).toBe(
      'Name',
    );
    expect(withQuoteLine(quote(), 'pageTitle', true).pageTitle).toBe('Sam Rivera');
  });

  it('leaves every other element alone', () => {
    const card = createShape('card', 0, 0);
    expect(withQuoteLook(card, 'plain')).toBe(card);
    expect(withQuotePortrait(card, null)).toBe(card);
    expect(withQuoteLine(card, 'pageTitle', false)).toBe(card);
  });
});

describe('quoteLayout', () => {
  const slots = { look: 'card', portrait: true, name: true, role: true, labelPx: 18 } as const;

  it('places every slot inside the box, none over another', () => {
    for (const [w, h] of [
      [460, 220],
      [800, 300],
      [300, 400],
    ] as const) {
      const l = quoteLayout(w, h, slots);
      const rects = [l.mark, l.body, l.portrait, l.name, l.role].filter(Boolean) as LayoutRect[];
      for (const r of rects) expect(inside(r, w, h), `${w}x${h}`).toBe(true);
      for (let a = 0; a < rects.length; a += 1)
        for (let b = a + 1; b < rects.length; b += 1)
          if (!(rects[a] === l.name && rects[b] === l.role))
            expect(overlaps(rects[a]!, rects[b]!), `${w}x${h} ${a}/${b}`).toBe(false);
      expect(l.name!.x).toBeGreaterThan(l.portrait!.x + l.portrait!.width);
    }
  });

  it('the Plain look has no padding; the Card is inset', () => {
    expect(quoteLayout(460, 220, { ...slots, look: 'plain' }).mark!.x).toBe(0);
    expect(quoteLayout(460, 220, slots).mark!.x).toBeGreaterThan(0);
  });

  it('a small box drops the role, then the portrait, then the mark, never the words', () => {
    const keeps = (h: number) => {
      const l = quoteLayout(400, h, slots);
      return [!!l.role, !!l.portrait, !!l.mark];
    };
    expect(keeps(160)).toEqual([true, true, true]);
    expect(keeps(116)).toEqual([false, true, true]);
    expect(keeps(108)).toEqual([false, false, true]);
    expect(keeps(60)).toEqual([false, false, false]);
    expect(quoteLayout(400, 60, slots).body.width).toBeGreaterThan(0);
  });

  it('reads its slots from the element', () => {
    expect(quoteSlotsOf(applyShapeVariant(quote(), 'pull'), 18)).toEqual({
      look: 'plain',
      portrait: false,
      name: true,
      role: false,
      labelPx: 18,
    });
  });
});
