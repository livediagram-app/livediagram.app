import { describe, expect, it } from 'vitest';
import {
  compactPageDesign,
  defaultTuning,
  isNoDesign,
  parsePageDesign,
  parsePageDesignOverride,
  resolveTuning,
  samePageDesign,
  tabPageDesignOf,
} from './tuning';

describe('page design tuning (docs/specs/011-theme/blueprints/page-designs.md "Data and persistence")', () => {
  it('drops a design whose id is not in the catalogue', () => {
    expect(parsePageDesign({ id: 'nope' })).toBeUndefined();
    expect(parsePageDesign('aurora')).toBeUndefined();
    expect(parsePageDesign(null)).toBeUndefined();
  });

  it('keeps valid fields and drops the rest', () => {
    expect(
      parsePageDesign({
        id: 'aurora',
        colors: ['#AABBCC', '#112233', '#445566'],
        intensity: 0.4,
        scale: 9,
        angle: 725.4,
        seed: 42.4,
        focus: [0.2, 0.9],
        blur: 0.1,
        grain: 0.3,
        calm: -1,
        variant: 'nope',
        animate: true,
        speed: 2,
        rhythm: true,
        flow: true,
        guard: 'warn',
      }),
    ).toEqual({
      id: 'aurora',
      colors: ['#aabbcc', '#112233', '#445566'],
      intensity: 0.4,
      angle: 5,
      seed: 42,
      focus: [0.2, 0.9],
      blur: 0.1,
      grain: 0.3,
      animate: true,
      speed: 2,
      rhythm: true,
      flow: true,
      guard: 'warn',
    });
  });

  it('keeps animation, flow and a style only where the design has them', () => {
    expect(parsePageDesign({ id: 'grid', animate: true, flow: true, variant: 'dashed' })).toEqual({
      id: 'grid',
      variant: 'dashed',
    });
    expect(
      parsePageDesign({ id: 'grid', colors: ['#fff', '#000', '#123'], focus: [2, 0] }),
    ).toEqual({
      id: 'grid',
    });
  });

  it('compacts fields at their defaults away', () => {
    const t = defaultTuning('soft-mesh');
    expect(
      compactPageDesign({
        id: 'soft-mesh',
        intensity: t.intensity,
        focus: t.focus,
        speed: 1,
        variant: '',
      }),
    ).toEqual({ id: 'soft-mesh' });
    expect(compactPageDesign({ id: 'grid', variant: 'lines' })).toEqual({ id: 'grid' });
  });

  it('resolves defaults under the stored fields', () => {
    const t = resolveTuning({ id: 'dots', seed: 3, guard: 'warn' });
    expect(t).toMatchObject({
      seed: 3,
      scale: 1,
      variant: 'fade',
      guard: 'warn',
      animate: false,
      speed: 1,
    });
    expect(resolveTuning({ id: 'dots' }).guard).toBe('scrim');
  });

  it('reads a page override of none, and tells designs apart', () => {
    expect(parsePageDesignOverride({ id: 'none' })).toEqual({ id: 'none' });
    expect(isNoDesign({ id: 'none' })).toBe(true);
    expect(isNoDesign(undefined)).toBe(false);
    expect(parsePageDesignOverride({ id: 'blobs' })).toEqual({ id: 'blobs' });
    expect(samePageDesign(undefined, undefined)).toBe(true);
    expect(samePageDesign({ id: 'blobs' }, undefined)).toBe(false);
    expect(samePageDesign({ id: 'blobs' }, { id: 'blobs' })).toBe(true);
    expect(tabPageDesignOf({ pageDesign: { id: 'waves' } })).toEqual({ id: 'waves' });
  });
});
