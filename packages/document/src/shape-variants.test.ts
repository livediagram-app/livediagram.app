import { describe, expect, it } from 'vitest';
import {
  applyShapeVariant,
  badgePresetFace,
  BADGE_PRESET_VARIANTS,
  CARD_PRESET_VARIANTS,
  cardLayout,
  cardSlotsOf,
  createShape,
  isValidElement,
  type ShapeElement,
} from './index';

// docs/specs/009-elements/card.md "Card presets": each preset is an ordinary card with its own slots switched on.

const card = () => createShape('card', 0, 0) as ShapeElement;

describe('card presets', () => {
  it('leaves the Service preset (no variant) as the card it was', () => {
    const c = card();
    expect(applyShapeVariant(c, undefined)).toBe(c);
  });

  it('Compact keeps the tile, title and meta line, and drops the body and tags', () => {
    const c = applyShapeVariant(card(), 'compact');
    expect(c).toMatchObject({ width: 240, height: 64, cardMedia: 'tile', label: '' });
    expect(c.pageTitle).toBeTruthy();
    expect(c.pageSubtitle).toBeTruthy();
    expect(c.tags).toBeUndefined();
  });

  it('Panel turns on the header band with a badge, and drops the tags', () => {
    const c = applyShapeVariant(card(), 'panel');
    expect(c).toMatchObject({ cardHeader: true, cardMedia: 'badge', iconId: 'server' });
    expect(c.tags).toBeUndefined();
  });

  it('Person is an initial with a name, role, line and Persona tag, and no icon', () => {
    const c = applyShapeVariant(card(), 'person');
    expect(c).toMatchObject({ cardMedia: 'initial', pageTitle: 'Maya Chen', tags: ['Persona'] });
    expect(c.iconId).toBeUndefined();
  });

  it('Accent has a left accent edge and no media, meta line or tags', () => {
    const c = applyShapeVariant(card(), 'accent');
    expect(c.accentEdge).toBe('left');
    expect(c.cardMedia).toBeUndefined();
    expect(c.pageSubtitle).toBeUndefined();
    expect(c.tags).toBeUndefined();
  });

  it('gives every preset a valid card whose layout keeps every slot it switched on', () => {
    for (const v of CARD_PRESET_VARIANTS) {
      const c = applyShapeVariant(card(), v);
      expect(c.shape, v).toBe('card');
      expect(isValidElement(c), v).toBe(true);
      const slots = cardSlotsOf(c);
      const l = cardLayout(c.width, c.height, slots);
      expect(l.title, v).not.toBeNull();
      expect(!!l.meta, v).toBe(slots.meta);
      expect(!!l.media, v).toBe(slots.media);
      expect(l.tags.length, v).toBe(slots.tags.length);
    }
  });

  it('ignores a card variant on another kind', () => {
    const sq = createShape('square', 0, 0) as ShapeElement;
    expect(applyShapeVariant(sq, 'panel')).toBe(sq);
  });
});

// docs/specs/009-elements/badge.md "Badge presets".
describe('badge presets', () => {
  const badge = () => createShape('badge', 0, 0) as ShapeElement;

  it('gives each preset its text and look, and keeps it a valid badge', () => {
    expect(applyShapeVariant(badge(), 'beta')).toMatchObject({ label: 'Beta', chipLook: 'tinted' });
    expect(applyShapeVariant(badge(), 'warning')).toMatchObject({
      label: 'PII',
      chipLook: 'solid',
      strokeColor: '#e11d48',
    });
    for (const v of BADGE_PRESET_VARIANTS) {
      const b = applyShapeVariant(badge(), v);
      expect(b.shape, v).toBe('badge');
      expect(isValidElement(b), v).toBe(true);
    }
  });

  it('leaves the New preset (no variant) and an unknown variant as the badge it was', () => {
    const b = badge();
    expect(applyShapeVariant(b, undefined)).toBe(b);
    expect(applyShapeVariant(b, 'toString')).toBe(b);
  });
});

describe('badgePresetFace', () => {
  it('reads each preset as it lands, the New preset a fresh badge', () => {
    expect(badgePresetFace(undefined)).toEqual({ label: 'New', look: 'solid' });
    expect(badgePresetFace('warning')).toEqual({ label: 'PII', look: 'solid', accent: '#e11d48' });
    expect(badgePresetFace('count')).toEqual({ label: '3×', look: 'ink' });
    expect(badgePresetFace('nope')).toEqual({ label: 'New', look: 'solid' });
  });

  it('matches what applyShapeVariant gives a fresh badge', () => {
    for (const variant of [undefined, ...BADGE_PRESET_VARIANTS]) {
      const el = applyShapeVariant(createShape('badge', 0, 0), variant);
      const face = badgePresetFace(variant);
      expect(face.label).toBe(el.label);
      expect(face.look).toBe(el.chipLook ?? 'solid');
      expect(face.accent).toBe(el.strokeColor);
    }
  });
});
