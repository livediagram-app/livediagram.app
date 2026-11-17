import { describe, expect, it } from 'vitest';
import {
  C4_CARD_W,
  C4_DATABASE_H,
  C4_LOOK,
  applyC4Variant,
  c4CardHeight,
  c4CardWidth,
  c4NodeElement,
  isC4Kind,
  isC4Variant,
  withC4VariantColours,
} from './c4-look';
import { applyShapeVariant, withVariantColours } from './shape-variants';
import { createShape } from './shape-factory';

// The C4 look (docs/specs/010-palette/build-category.md "The C4 model"): one palette and card for the templates, the
// palette's tiles and the graph's c4 style.

describe('the C4 card', () => {
  it('widens for a long name, up to a cap', () => {
    expect(c4CardWidth('Pricing')).toBe(C4_CARD_W);
    expect(c4CardWidth('Personal banking customer')).toBeGreaterThan(C4_CARD_W);
    expect(c4CardWidth('x'.repeat(200))).toBe(420);
  });

  it('grows a line at a time for its description, up to four', () => {
    expect(c4CardHeight('')).toBe(84);
    expect(c4CardHeight('Short.')).toBe(104);
    expect(c4CardHeight('x'.repeat(70))).toBe(144);
    expect(c4CardHeight('x'.repeat(500))).toBe(164);
    // A wider card fits more on a line.
    expect(c4CardHeight('x'.repeat(40), 420)).toBe(104);
  });

  it('knows its kinds', () => {
    expect(isC4Kind('component')).toBe(true);
    expect(isC4Kind('robot')).toBe(false);
  });

  it('makes a graph node a card of its kind, or a database cylinder', () => {
    expect(
      c4NodeElement('a', 'Pricing', { kind: 'component', meta: 'Go', body: '', icon: 'percent' }),
    ).toMatchObject({
      id: 'a',
      shape: 'card',
      iconId: 'percent',
      fillColor: C4_LOOK.component.fill,
    });
    expect(
      c4NodeElement('d', 'Orders', { kind: 'database', meta: 'PostgreSQL', body: '' }),
    ).toMatchObject({
      shape: 'cylinder',
      height: C4_DATABASE_H,
      label: 'Orders\nPostgreSQL',
    });
    expect(c4NodeElement('d', 'Orders', { kind: 'database', meta: '', body: '' }).label).toBe(
      'Orders',
    );
  });
});

describe('the C4 palette variants', () => {
  const card = createShape('card', 10, 20);
  const cylinder = createShape('cylinder', 10, 20);

  it('dresses a card or a cylinder as its kind', () => {
    expect(isC4Variant('c4-person')).toBe(true);
    expect(isC4Variant('funnel')).toBe(false);
    expect(isC4Variant(undefined)).toBe(false);
    expect(applyC4Variant(card, 'c4-container')).toMatchObject({
      x: 10,
      width: C4_CARD_W,
      pageTitle: 'Order service',
      fillColor: C4_LOOK.container.fill,
      themeLockFill: true,
    });
    expect(applyC4Variant(cylinder, 'c4-database')).toMatchObject({
      height: C4_DATABASE_H,
      label: 'Orders database\nPostgreSQL',
    });
  });

  it('leaves a variant that is not C4, or a shape of the wrong kind, alone', () => {
    expect(applyC4Variant(card, 'funnel')).toBeNull();
    expect(applyC4Variant(card, undefined)).toBeNull();
    expect(applyC4Variant(cylinder, 'c4-person')).toBeNull();
    expect(applyC4Variant(card, 'c4-database')).toBeNull();
  });

  it('puts its colours back after a theme dressed it', () => {
    const themed = { ...card, colorPreset: 'accent', fillSwatch: 2, fillColor: '#fff' };
    const back = withC4VariantColours(themed, 'c4-external')!;
    expect(back).toMatchObject({ fillColor: C4_LOOK.external.fill, themeLockFill: true });
    expect('colorPreset' in back).toBe(false);
    expect(withC4VariantColours(card, 'funnel')).toBeNull();
    expect(withC4VariantColours(card, undefined)).toBeNull();
  });

  it('is what the shared variant functions answer for a C4 variant, and the shared ones otherwise', () => {
    expect(applyShapeVariant(card, 'c4-person')).toMatchObject({ fillColor: C4_LOOK.person.fill });
    expect(applyShapeVariant(card, undefined)).toEqual(card);
    expect(withVariantColours(card, 'c4-system')).toMatchObject({ fillColor: C4_LOOK.system.fill });
    expect(withVariantColours(card, undefined)).toEqual(card);
  });
});
