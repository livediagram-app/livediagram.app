// docs/specs/020-import-export/svg-import.md "Style": every colour syntax a real file uses, as six-digit hex.
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { parseColour } from './colour';

describe('parseColour', () => {
  it('reads hex of 3, 4, 6 and 8 digits', () => {
    expect(parseColour('#F00')).toEqual({ hex: '#ff0000', alpha: 1 });
    expect(parseColour('#f008')?.alpha).toBeCloseTo(0x88 / 255);
    expect(parseColour('#00Aa11')).toEqual({ hex: '#00aa11', alpha: 1 });
    expect(parseColour('#00aa1180')?.alpha).toBeCloseTo(128 / 255);
    expect(parseColour('#12345')).toBeNull();
    expect(parseColour('#ggg')).toBeNull();
  });

  it('reads rgb() and rgba(), with commas, spaces, percentages and a slash alpha', () => {
    expect(parseColour('rgb(255, 0, 0)')).toEqual({ hex: '#ff0000', alpha: 1 });
    expect(parseColour('rgba(0,0,255,0.5)')).toEqual({ hex: '#0000ff', alpha: 0.5 });
    expect(parseColour('rgb(100% 0% 0% / 50%)')).toEqual({ hex: '#ff0000', alpha: 0.5 });
    expect(parseColour('rgb(300 -5 0)')).toEqual({ hex: '#ff0000', alpha: 1 });
  });

  it('reads hsl() and hsla(), a hue unit skipped', () => {
    expect(parseColour('hsl(0, 100%, 50%)')?.hex).toBe('#ff0000');
    expect(parseColour('hsl(120deg 100% 25%)')?.hex).toBe('#008000');
    expect(parseColour('hsla(240, 100%, 50%, 0.25)')).toEqual({ hex: '#0000ff', alpha: 0.25 });
    for (const [h, hex] of [
      [60, '#ffff00'],
      [180, '#00ffff'],
      [300, '#ff00ff'],
      [-60, '#ff00ff'],
    ] as const)
      expect(parseColour(`hsl(${h} 100% 50%)`)?.hex).toBe(hex);
  });

  it('reads named colours and transparent', () => {
    expect(parseColour('RebeccaPurple')).toEqual({ hex: '#663399', alpha: 1 });
    expect(parseColour('yellowgreen')?.hex).toBe('#9acd32');
    expect(parseColour('transparent')).toEqual({ hex: '#000000', alpha: 0 });
  });

  it('answers null for what is not a colour', () => {
    for (const v of [
      '',
      'none',
      'notacolour',
      'url(#g)',
      'rgb(1,2)',
      'rgb(a,b,c)',
      'lab(1 2 3)',
      'rgb(1 2 3 4 5)',
    ])
      expect(parseColour(v)).toBeNull();
  });

  it('reads a colour of huge spaces in linear time', () => {
    const ms = cpuMsOf(() => {
      parseColour(`rgb(${' '.repeat(100_000)}1 2 3)`);
      parseColour(`rgb(${'1'.repeat(100_000)} 2 3)`);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });
});
