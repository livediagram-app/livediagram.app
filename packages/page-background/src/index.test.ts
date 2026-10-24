import { describe, expect, it } from 'vitest';
import { isPageMotion, parseColourBackground, parseColourFill, parsePagePattern } from './index';

// A colour background (a page's in livedocuments and livedesign, a form cover's in liveplanner).

describe('parseColourFill', () => {
  it('reads a solid colour and a gradient, its angle brought into 0 to 359', () => {
    expect(parseColourFill({ kind: 'solid', color: '#abc' })).toEqual({
      kind: 'solid',
      color: '#abc',
    });
    expect(
      parseColourFill({ kind: 'gradient', from: '#000000', to: '#ffffff', angle: -90 }),
    ).toEqual({
      kind: 'gradient',
      from: '#000000',
      to: '#ffffff',
      angle: 270,
    });
    expect(parseColourFill({ kind: 'gradient', from: '#000', to: '#fff' })).toMatchObject({
      angle: 180,
    });
  });

  it('keeps a known motion and a speed in range other than its own pace', () => {
    const g = { kind: 'gradient', from: '#000', to: '#fff', angle: 0 };
    expect(parseColourFill({ ...g, motion: 'aurora', speed: 2 })).toMatchObject({
      motion: 'aurora',
      speed: 2,
    });
    expect(parseColourFill({ ...g, motion: 'aurora', speed: 1 })).not.toHaveProperty('speed');
    expect(parseColourFill({ ...g, motion: 'aurora', speed: 9 })).not.toHaveProperty('speed');
    expect(parseColourFill({ ...g, motion: 'nope', speed: 2 })).toEqual({ ...g });
  });

  it('refuses anything else, a picture included', () => {
    for (const v of [
      null,
      3,
      { kind: 'solid', color: 'red' },
      { kind: 'gradient', from: '#000' },
      { kind: 'image' },
    ])
      expect(parseColourFill(v)).toBeUndefined();
  });
});

describe('parseColourBackground', () => {
  it('keeps the valid fill and pattern, and nothing when neither is', () => {
    expect(
      parseColourBackground({ fill: { kind: 'solid', color: '#fff' }, pattern: 'dots' }),
    ).toEqual({
      fill: { kind: 'solid', color: '#fff' },
      pattern: 'dots',
    });
    expect(parseColourBackground({ pattern: 'grid', fill: { kind: 'image' } })).toEqual({
      pattern: 'grid',
    });
    expect(parseColourBackground({ fill: { kind: 'solid', color: '#fff' } })).toEqual({
      fill: { kind: 'solid', color: '#fff' },
    });
    expect(parseColourBackground({ pattern: 'stripes' })).toBeUndefined();
    expect(parseColourBackground('x')).toBeUndefined();
    expect(parseColourBackground(null)).toBeUndefined();
  });

  it('knows the patterns and motions', () => {
    expect(parsePagePattern('lines')).toBe('lines');
    expect(isPageMotion('threads')).toBe(true);
    expect(isPageMotion(3)).toBe(false);
  });
});
