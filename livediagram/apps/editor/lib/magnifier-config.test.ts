import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampMagnifierConfig,
  DEFAULT_MAGNIFIER_CONFIG,
  formatMagnification,
  loadMagnifierConfig,
  MAGNIFIER_STORAGE_KEY,
  magnifierSizePreset,
  saveMagnifierConfig,
} from './magnifier-config';

// docs/specs/008-canvas/magnifier.md "Settings" and "Persistence".
describe('clampMagnifierConfig', () => {
  it('reads nothing, or anything but an object, as the defaults', () => {
    for (const raw of [null, undefined, 3, 'nonsense', '{broken']) {
      expect(clampMagnifierConfig(raw)).toEqual(DEFAULT_MAGNIFIER_CONFIG);
    }
  });

  it('clamps each field into its range, and rounds', () => {
    expect(clampMagnifierConfig({ zoom: 40, size: 9000, shape: 'round' })).toEqual({
      zoom: 6,
      size: 480,
      shape: 'round',
    });
    expect(clampMagnifierConfig({ zoom: 0.2, size: 3, shape: 'square' })).toEqual({
      zoom: 1.5,
      size: 120,
      shape: 'square',
    });
    expect(clampMagnifierConfig({ zoom: 2.345, size: 200.6 })).toMatchObject({
      zoom: 2.3,
      size: 201,
    });
  });

  it('takes the default for a field it cannot read', () => {
    expect(clampMagnifierConfig({ zoom: 'big', size: Number.NaN, shape: 'hexagon' })).toEqual(
      DEFAULT_MAGNIFIER_CONFIG,
    );
  });

  it('reads stored JSON text too', () => {
    expect(clampMagnifierConfig('{"zoom":3,"size":160,"shape":"round"}')).toEqual({
      zoom: 3,
      size: 160,
      shape: 'round',
    });
  });
});

describe('magnifierSizePreset', () => {
  it('names the preset a size matches, and Custom between them', () => {
    expect(magnifierSizePreset(160)).toBe('small');
    expect(magnifierSizePreset(240)).toBe('medium');
    expect(magnifierSizePreset(360)).toBe('large');
    expect(magnifierSizePreset(300)).toBe('custom');
  });
});

describe('formatMagnification', () => {
  it('says the magnification to one decimal at most', () => {
    expect(formatMagnification(2)).toBe('2x');
    expect(formatMagnification(2.5)).toBe('2.5x');
    expect(formatMagnification(3.26)).toBe('3.3x');
  });
});

describe('load and save', () => {
  const store = new Map<string, string>();
  afterEach(() => {
    store.clear();
    vi.unstubAllGlobals();
  });

  it('round-trips through localStorage, and reads the defaults when nothing is stored', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    expect(loadMagnifierConfig()).toEqual(DEFAULT_MAGNIFIER_CONFIG);
    saveMagnifierConfig({ zoom: 4, size: 360, shape: 'round' });
    expect(JSON.parse(store.get(MAGNIFIER_STORAGE_KEY)!)).toEqual({
      zoom: 4,
      size: 360,
      shape: 'round',
    });
    expect(loadMagnifierConfig()).toEqual({ zoom: 4, size: 360, shape: 'round' });
  });
});
