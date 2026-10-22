import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPOTLIGHT_CONFIG,
  parseSpotlightConfig,
  spotlightExtent,
  spotlightFeather,
  spotlightRadius,
  spotlightShroud,
  spotlightSizeOf,
  SPOTLIGHT_DIMS,
  SPOTLIGHT_EDGES,
  SPOTLIGHT_SHAPES,
  SPOTLIGHT_SIZES,
} from './spotlight-config';

describe('the default look', () => {
  it('is the spotlight as it always was: medium circle, 82% shroud, soft rim', () => {
    // Someone who never opens the panel must see no change at all.
    expect(DEFAULT_SPOTLIGHT_CONFIG).toEqual({
      size: 'medium',
      dim: 'normal',
      edge: 'soft',
      shape: 'circle',
    });
    expect(spotlightShroud(DEFAULT_SPOTLIGHT_CONFIG)).toBe('rgba(2, 6, 23, 0.82)');
    expect(spotlightFeather(DEFAULT_SPOTLIGHT_CONFIG)).toBe(60);
    expect(spotlightRadius('medium')).toBe(170);
  });
});

describe('spotlightExtent', () => {
  it('is the radius both ways for a circle', () => {
    expect(spotlightExtent(DEFAULT_SPOTLIGHT_CONFIG, 200)).toEqual({ rx: 200, ry: 200 });
  });

  it('spreads sideways and flattens for the wide light', () => {
    const wide = spotlightExtent({ ...DEFAULT_SPOTLIGHT_CONFIG, shape: 'wide' }, 200);
    expect(wide.rx).toBeGreaterThan(200);
    expect(wide.ry).toBeLessThan(200);
    // Roughly the same lit area, so switching shape doesn't make the room
    // suddenly much darker or much brighter.
    const circleArea = Math.PI * 200 * 200;
    const wideArea = Math.PI * wide.rx * wide.ry;
    expect(Math.abs(wideArea - circleArea) / circleArea).toBeLessThan(0.05);
  });
});

describe('spotlightSizeOf', () => {
  it('names the preset a radius matches', () => {
    for (const size of SPOTLIGHT_SIZES) {
      expect(spotlightSizeOf(spotlightRadius(size.id))).toBe(size.id);
    }
  });

  it('reports no preset once a click has nudged the radius', () => {
    // The panel shows "Custom" for this rather than claiming a size the light
    // is not actually at.
    expect(spotlightSizeOf(spotlightRadius('medium') + 13)).toBeNull();
  });
});

describe('the catalogues', () => {
  it('give every dim, edge, and shape a hint the label alone does not carry', () => {
    for (const option of [...SPOTLIGHT_DIMS, ...SPOTLIGHT_EDGES, ...SPOTLIGHT_SHAPES]) {
      expect(option.hint.length).toBeGreaterThan(0);
    }
  });

  it('gets darker down the Dim list and softer up the Edge list', () => {
    const alphas = SPOTLIGHT_DIMS.map((d) =>
      Number(spotlightShroud({ ...DEFAULT_SPOTLIGHT_CONFIG, dim: d.id }).match(/([\d.]+)\)$/)![1]),
    );
    expect([...alphas].sort((a, b) => a - b)).toEqual(alphas);
    expect(spotlightFeather({ ...DEFAULT_SPOTLIGHT_CONFIG, edge: 'crisp' })).toBeLessThan(
      spotlightFeather({ ...DEFAULT_SPOTLIGHT_CONFIG, edge: 'soft' }),
    );
  });
});

describe('parseSpotlightConfig', () => {
  it('takes a whole valid look', () => {
    const look = { size: 'large', dim: 'blackout', edge: 'crisp', shape: 'wide' } as const;
    expect(parseSpotlightConfig(look)).toEqual(look);
  });

  it('costs one FIELD, not the whole look, when a token is unknown', () => {
    expect(
      parseSpotlightConfig({ size: 'enormous', dim: 'blackout', edge: 'crisp', shape: 'wide' }),
    ).toEqual({ size: 'medium', dim: 'blackout', edge: 'crisp', shape: 'wide' });
  });

  it('falls back completely for junk', () => {
    expect(parseSpotlightConfig(null)).toEqual(DEFAULT_SPOTLIGHT_CONFIG);
    expect(parseSpotlightConfig('not json')).toEqual(DEFAULT_SPOTLIGHT_CONFIG);
  });
});
