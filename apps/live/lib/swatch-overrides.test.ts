import { THEMES, quickSwatches } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import {
  SWATCH_OVERRIDE_MAX_BYTES,
  SWATCH_OVERRIDE_MAX_THEMES,
  applySwatchOverrides,
  normaliseHex,
  overridesForTheme,
  parseSwatchOverrideStore,
  pruneSwatchOverrideStore,
  storeWithOverride,
  storeWithoutOverride,
  type SwatchOverrideStore,
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
    const row = applySwatchOverrides(strokes, { 0: '#ff5500' } as never);
    expect(row[0]).toBe(strokes[0]);
  });
});

describe('the theme-keyed store', () => {
  it('keeps overrides per theme: another theme shows its own slots', () => {
    const store = storeWithOverride([], 'forest', 'stroke', 4, '#ff5500');
    expect(overridesForTheme(store, 'forest')).toEqual({ stroke: { 4: '#ff5500' } });
    expect(overridesForTheme(store, 'ocean')).toEqual({});
  });

  it('puts the theme just edited first, and keeps one entry per theme', () => {
    let store = storeWithOverride([], 'forest', 'stroke', 1, '#111111');
    store = storeWithOverride(store, 'ocean', 'fill', 2, '#222222');
    store = storeWithOverride(store, 'forest', 'fill', 3, '#333333');
    expect(store.map((e) => e.t)).toEqual(['forest', 'ocean']);
    expect(overridesForTheme(store, 'forest')).toEqual({
      stroke: { 1: '#111111' },
      fill: { 3: '#333333' },
    });
  });

  it('clearing restores the slot, and drops a theme with nothing left', () => {
    let store = storeWithOverride([], 'forest', 'stroke', 4, '#ff5500');
    store = storeWithOverride(store, 'forest', 'fill', 1, '#123456');
    store = storeWithoutOverride(store, 'forest', 'stroke', 4);
    expect(overridesForTheme(store, 'forest')).toEqual({ fill: { 1: '#123456' } });
    expect(storeWithoutOverride(store, 'forest', 'fill', 1)).toEqual([]);
    expect(storeWithoutOverride(store, 'ocean', 'fill', 1)).toBe(store);
  });

  it('keeps at most the most recently edited themes', () => {
    let store: SwatchOverrideStore = [];
    for (let i = 0; i < SWATCH_OVERRIDE_MAX_THEMES + 3; i++) {
      store = storeWithOverride(store, `theme-${i}`, 'stroke', 1, '#010203');
    }
    expect(store).toHaveLength(SWATCH_OVERRIDE_MAX_THEMES);
    expect(store[0]!.t).toBe(`theme-${SWATCH_OVERRIDE_MAX_THEMES + 2}`);
  });

  it('stays inside its byte budget, dropping the least recently edited theme', () => {
    let store: SwatchOverrideStore = [];
    for (let i = 0; i < SWATCH_OVERRIDE_MAX_THEMES; i++) {
      for (const slot of [1, 2, 3, 4, 5, 6] as const) {
        store = storeWithOverride(
          store,
          `custom:0000000${i}-aaaa-bbbb-cccc-dddddddddddd`,
          'stroke',
          slot,
          '#abcdef',
        );
        store = storeWithOverride(
          store,
          `custom:0000000${i}-aaaa-bbbb-cccc-dddddddddddd`,
          'fill',
          slot,
          '#abcdef',
        );
      }
    }
    expect(JSON.stringify(store).length).toBeLessThanOrEqual(SWATCH_OVERRIDE_MAX_BYTES);
    expect(store[0]!.t).toContain('00000007');
  });

  it('prunes themes that no longer exist', () => {
    let store = storeWithOverride([], 'custom:gone', 'stroke', 1, '#111111');
    store = storeWithOverride(store, 'forest', 'stroke', 1, '#111111');
    expect(pruneSwatchOverrideStore(store, (id) => id !== 'custom:gone').map((e) => e.t)).toEqual([
      'forest',
    ]);
    expect(pruneSwatchOverrideStore(store, () => true)).toBe(store);
  });
});

describe('parseSwatchOverrideStore', () => {
  it('keeps valid themes, slots and colours, and drops the rest', () => {
    const raw: unknown = [
      { t: 'forest', s: { 1: '#FF0000', 0: '#00ff00', 7: '#00ff00', 3: 'blue' }, f: { 6: '#abc' } },
      { t: 'forest', s: { 2: '#000000' } },
      { t: '', s: { 1: '#ffffff' } },
      { s: { 1: '#ffffff' } },
      { t: 'ocean' },
      'junk',
    ];
    expect(parseSwatchOverrideStore(raw)).toEqual([
      { t: 'forest', s: { 1: '#ff0000' }, f: { 6: '#aabbcc' } },
    ]);
  });

  it('reads anything else as none', () => {
    for (const bad of [undefined, null, '[]', {}, 5])
      expect(parseSwatchOverrideStore(bad)).toEqual([]);
  });
});
