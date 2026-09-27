import { THEMES, quickSwatches } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import {
  applySwatchOverrides,
  normaliseHex,
  parseSwatchOverrides,
  withOverride,
  withoutOverride,
} from './swatch-overrides';

// docs/specs/008-canvas/quick-style-panel.md "Custom swatches".

const forest = THEMES.find((t) => t.id === 'forest')!;
const strokes = quickSwatches(forest, 'stroke');

describe('normaliseHex', () => {
  it('accepts #RGB and #RRGGBB, with or without the hash, as lower case', () => {
    expect(normaliseHex('#F80')).toBe('#ff8800');
    expect(normaliseHex('1A2B3C')).toBe('#1a2b3c');
    expect(normaliseHex(' #abcdef ')).toBe('#abcdef');
  });

  it('rejects anything else', () => {
    for (const bad of ['', '#12', '#12345', 'red', '#gggggg', 'rgb(0,0,0)']) {
      expect(normaliseHex(bad)).toBeNull();
    }
  });
});

describe('applySwatchOverrides', () => {
  it('replaces the overridden slot with the custom colour, named for what it replaces', () => {
    const row = applySwatchOverrides(strokes, { 4: '#ff5500' });
    expect(row[4]).toEqual({
      slot: 4,
      color: '#ff5500',
      name: 'Custom orange, in place of Green',
      override: { themeColor: strokes[4]!.color, themeName: 'Green' },
    });
  });

  it('leaves the other swatches as they are, and the row as it is with no overrides', () => {
    const row = applySwatchOverrides(strokes, { 4: '#ff5500' });
    expect(row[3]).toBe(strokes[3]);
    expect(applySwatchOverrides(strokes, undefined)).toBe(strokes);
  });

  it('never overrides the theme default', () => {
    const row = applySwatchOverrides(strokes, { 0: '#ff8800' } as never);
    expect(row[0]).toBe(strokes[0]);
  });
});

describe('withOverride / withoutOverride', () => {
  it('sets and clears one slot of one row', () => {
    const set = withOverride({}, 'fill', 2, '#123456');
    expect(set).toEqual({ fill: { 2: '#123456' } });
    expect(withoutOverride(set, 'fill', 2)).toEqual({});
    expect(withoutOverride(set, 'stroke', 2)).toBe(set);
  });
});

describe('parseSwatchOverrides', () => {
  it('keeps valid slots and colours, and drops the rest', () => {
    const raw = JSON.stringify({
      stroke: { 1: '#FF0000', 0: '#00ff00', 7: '#00ff00', 3: 'blue' },
      fill: { 6: '#abc' },
      other: { 1: '#ffffff' },
    });
    expect(parseSwatchOverrides(raw)).toEqual({ stroke: { 1: '#ff0000' }, fill: { 6: '#aabbcc' } });
  });

  it('reads garbage as none', () => {
    expect(parseSwatchOverrides(null)).toEqual({});
    expect(parseSwatchOverrides('{')).toEqual({});
    expect(parseSwatchOverrides('[]')).toEqual({});
  });
});
