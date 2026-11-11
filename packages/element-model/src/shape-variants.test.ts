import { describe, expect, it } from 'vitest';
import { BADGE_NEW_LABEL } from './chip';
import type { ShapeElement } from './element';
import {
  applyShapeVariant,
  badgePresetFace,
  BADGE_PRESET_VARIANTS,
  CARD_PRESET_VARIANTS,
  withVariantColours,
} from './shape-variants';
import { createShape } from './testing/elements';

// docs/specs/009-elements/card.md "Card presets" and badge.md "Badge presets". Each product's own test also reads
// its card layout and validator through the binding.
const shape = (kind: string, over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape(kind, 0, 0),
  ...over,
});

describe('applyShapeVariant', () => {
  it('leaves an element as it was with no variant, or one its kind does not have', () => {
    const sq = shape('square');
    expect(applyShapeVariant(sq, undefined)).toBe(sq);
    expect(applyShapeVariant(sq, 'compact')).toBe(sq);
    const card = shape('card');
    expect(applyShapeVariant(card, 'nonsense')).toBe(card);
  });

  it('dresses each card preset', () => {
    const card = shape('card', { tags: ['A'], pageSubtitle: 'Meta', iconId: 'server' });
    expect(applyShapeVariant(card, 'compact')).toMatchObject({ width: 240, label: '' });
    expect(applyShapeVariant(card, 'compact').tags).toBeUndefined();
    expect(applyShapeVariant(card, 'panel')).toMatchObject({ cardHeader: true, iconId: 'server' });
    expect(applyShapeVariant(card, 'person')).toMatchObject({
      cardMedia: 'initial',
      tags: ['Persona'],
    });
    const accent = applyShapeVariant({ ...card, cardMedia: 'tile' }, 'accent');
    expect(accent).toMatchObject({ accentEdge: 'left' });
    expect(accent.cardMedia).toBeUndefined();
    const callout = applyShapeVariant(card, 'callout');
    expect(callout).toMatchObject({ cardMedia: 'badge', pageTitle: 'Heads up' });
    expect(callout.pageSubtitle).toBeUndefined();
    expect(CARD_PRESET_VARIANTS).toContain('callout');
  });

  it('dresses the org chart person, the badges and the pyramids', () => {
    expect(applyShapeVariant(shape('mind-node'), 'org-chart')).toMatchObject({
      mindLook: 'person',
      mindFlow: 'downward',
    });
    for (const v of BADGE_PRESET_VARIANTS)
      expect(applyShapeVariant(shape('badge'), v).chipLook).toBeTruthy();
    expect(applyShapeVariant(shape('pyramid'), 'funnel').conceptRows).toHaveLength(4);
    expect(applyShapeVariant(shape('pyramid'), 'inverted').pyramidVariant).toBe('inverted');
  });
});

describe('badgePresetFace', () => {
  it('is the New badge with no variant, else the preset with its own colour', () => {
    expect(badgePresetFace(undefined)).toEqual({ label: BADGE_NEW_LABEL, look: 'solid' });
    expect(badgePresetFace('beta')).toEqual({ label: 'Beta', look: 'tinted' });
    expect(badgePresetFace('warning')).toEqual({ label: 'PII', look: 'solid', accent: '#e11d48' });
  });
});

describe('withVariantColours', () => {
  it("puts the Warning badge's rose back over a theme's or a remembered style", () => {
    const themed = { ...shape('badge'), strokeColor: '#2563eb', strokeSwatch: 2 } as ShapeElement;
    const out = withVariantColours(themed, 'warning') as ShapeElement & { strokeSwatch?: number };
    expect(out.strokeColor).toBe('#e11d48');
    expect(out.strokeSwatch).toBeUndefined();
  });

  it('leaves an element its variant fixes no colour for, or already in it', () => {
    const badge = shape('badge', { strokeColor: '#e11d48' });
    expect(withVariantColours(badge, 'warning')).toBe(badge);
    expect(withVariantColours(badge, 'beta')).toBe(badge);
    expect(withVariantColours(badge, undefined)).toBe(badge);
    const card = shape('card');
    expect(withVariantColours(card, 'warning')).toBe(card);
  });
});
