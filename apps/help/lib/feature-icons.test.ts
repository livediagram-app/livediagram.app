import { describe, expect, it } from 'vitest';
import { articles, categories } from './articles';
import { FEATURE_CATEGORY_ICONS, FEATURE_ICONS, featureIcon } from './featureIcons';
import {
  FEATURE_CATEGORY_HEX,
  FEATURE_ENTITY_HEX,
  FEATURE_FALLBACK_HEX,
  featureColour,
} from './featureColours';

// The feature-card icon + accent resolution (spec/55).
//
// The state this replaced: 107 of the 172 landing cards under the ten feature
// categories had no entry in FEATURE_ICONS, so nearly two thirds of the
// catalogue drew the same `the-canvas` frame in the same fallback grey. Nothing
// failed, because a missing key resolves to a valid icon — which is exactly why
// it needs a test rather than a look.

const featureCategories = categories.filter((c) => c.kind === 'feature');

describe('feature category fallbacks', () => {
  it('found the feature categories at all', () => {
    expect(featureCategories.length).toBeGreaterThan(5);
  });

  it('gives every feature category a glyph and a hue', () => {
    const missing = featureCategories.filter(
      (c) => !FEATURE_CATEGORY_ICONS[c.slug] || !FEATURE_CATEGORY_HEX[c.slug],
    );
    expect(missing.map((c) => c.slug)).toEqual([]);
  });

  it('gives each category a distinct hue, so the fallback still groups', () => {
    const hues = featureCategories.map((c) => FEATURE_CATEGORY_HEX[c.slug]);
    expect(new Set(hues).size).toBe(hues.length);
  });

  it('defines no category fallback for a slug that is not a feature category', () => {
    const known = new Set(featureCategories.map((c) => c.slug));
    expect(Object.keys(FEATURE_CATEGORY_ICONS).filter((s) => !known.has(s))).toEqual([]);
    expect(Object.keys(FEATURE_CATEGORY_HEX).filter((s) => !known.has(s))).toEqual([]);
  });
});

describe('featureIcon / featureColour', () => {
  it("prefers the feature's own glyph and hue over its category's", () => {
    // `the-canvas` has both a bespoke entry and a category (canvas) fallback.
    expect(featureIcon('the-canvas', 'canvas')).toBe(FEATURE_ICONS['the-canvas']);
    expect(featureColour('the-canvas', 'canvas')).toBe(FEATURE_ENTITY_HEX['the-canvas']);
  });

  it('falls back to the top-level category for an unregistered slug', () => {
    expect(featureIcon('no-such-feature', 'palette')).toBe(FEATURE_CATEGORY_ICONS['palette']);
    expect(featureColour('no-such-feature', 'palette')).toBe(FEATURE_CATEGORY_HEX['palette']);
  });

  it('reads a NESTED category slug down to its first segment', () => {
    expect(featureIcon('no-such-feature', 'palette/tools/data-elements')).toBe(
      FEATURE_CATEGORY_ICONS['palette'],
    );
    expect(featureColour('no-such-feature', 'palette/tools/data-elements')).toBe(
      FEATURE_CATEGORY_HEX['palette'],
    );
  });

  it('falls back to the neutral defaults when there is no category either', () => {
    expect(featureIcon('no-such-feature')).toBe(FEATURE_ICONS['the-canvas']);
    expect(featureColour('no-such-feature')).toBe(FEATURE_FALLBACK_HEX);
  });
});

describe('the catalogue as rendered', () => {
  const inFeatureCategories = articles.filter((a) =>
    featureCategories.some((c) => a.categorySlug.split('/')[0] === c.slug),
  );

  it('no longer draws the canvas frame for a card that is not about the canvas', () => {
    const wrong = inFeatureCategories.filter(
      (a) =>
        a.categorySlug.split('/')[0] !== 'canvas' &&
        featureIcon(a.slug, a.categorySlug) === FEATURE_ICONS['the-canvas'],
    );
    expect(wrong.map((a) => a.slug)).toEqual([]);
  });

  it('resolves a glyph and an accent for every feature card', () => {
    for (const a of inFeatureCategories) {
      expect(featureIcon(a.slug, a.categorySlug)).toBeTruthy();
      expect(featureColour(a.slug, a.categorySlug)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  // A bespoke glyph paired with a category hue (or the reverse) reads as an
  // oversight, so the two per-feature maps are kept key-for-key identical.
  it('keeps the per-feature icon and hue maps in step', () => {
    const iconKeys = Object.keys(FEATURE_ICONS).sort();
    const hueKeys = Object.keys(FEATURE_ENTITY_HEX).sort();
    expect(iconKeys).toEqual(hueKeys);
  });
});
