import { describe, expect, it } from 'vitest';
import { ADJUSTMENT_IDS } from '@livedesign/photo-engine';
import { ADJUST_SPECS, getPath, setPath, withSetting } from './adjustment-fields';

describe('adjustment fields', () => {
  it('describes every adjustment, each field reading a value', () => {
    for (const id of ADJUSTMENT_IDS) {
      const spec = ADJUST_SPECS[id];
      const p = spec.read({});
      for (const f of spec.fields ?? [])
        expect(getPath(p, f.path), `${id} ${f.label}`).not.toBeUndefined();
      const prefix = spec.section?.options[0]?.prefix ?? [];
      for (const f of spec.sectioned ?? [])
        expect(getPath(p, [...prefix, ...f.path]), `${id} ${f.label}`).not.toBeUndefined();
    }
  });

  it('sets a path without touching the rest, arrays kept arrays', () => {
    const o = { a: { b: [1, 2, 3] }, c: 4 };
    const next = setPath(o, ['a', 'b', 1], 9);
    expect(next).toEqual({ a: { b: [1, 9, 3] }, c: 4 });
    expect(Array.isArray(next.a.b)).toBe(true);
    expect(o.a.b[1]).toBe(2);
  });

  it('writes a setting back in range, with every other one as read', () => {
    const p = withSetting('colour-balance', { midtones: [10, 0, 0] }, ['shadows', 2], 50);
    expect(p).toMatchObject({
      shadows: [0, 0, 50],
      midtones: [10, 0, 0],
      preserveLuminosity: true,
    });
    expect(withSetting('hue-saturation', {}, ['ranges', 'reds', 'hue'], 30)).toMatchObject({
      ranges: { reds: { hue: 30 } },
      master: { hue: 0 },
    });
  });
});
