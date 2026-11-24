import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { fitPreferences, PREFERENCES_BODY_MAX, preferencesBodyLength } from './preferences-fit';

afterEach(() => vi.restoreAllMocks());

const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('fitPreferences', () => {
  it('answers the same object when it already fits', () => {
    const prefs = { a: 1 };
    expect(fitPreferences(prefs, { deadKeys: ['gone'] })).toBe(prefs);
  });

  it('drops the dead keys first, in order, only while over the cap', () => {
    const warn = quiet();
    const prefs = {
      first: 'x'.repeat(PREFERENCES_BODY_MAX),
      second: ['y'],
      keep: true,
    };
    const fitted = fitPreferences(prefs, { deadKeys: ['missing', 'first', 'second'] });
    expect(fitted).toEqual({ second: ['y'], keep: true });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/dropped=1 length=\d+/));
  });

  it('counts a dead list by its entries', () => {
    const warn = quiet();
    fitPreferences(
      { hidden: Array.from({ length: 900 }, (_, i) => `id-${i}`) },
      { deadKeys: ['hidden'] },
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropped=900'));
  });

  it("then drops the growable map's least recently used entries", () => {
    quiet();
    const picks: Record<string, [number, number]> = {};
    for (let i = 0; i < 400; i += 1) picks[`shape-${i}`] = [1, i];
    const fitted = fitPreferences({ picks, keep: 'z' }, { deadKeys: [], growableMap: 'picks' });
    expect(preferencesBodyLength(fitted)).toBeLessThanOrEqual(PREFERENCES_BODY_MAX);
    const left = Object.keys(fitted.picks);
    expect(left).toContain('shape-399');
    expect(left).not.toContain('shape-0');
    expect(fitted.keep).toBe('z');
  });

  it('takes a malformed entry as the oldest', () => {
    quiet();
    const picks: Record<string, unknown> = { broken: null, odd: [1, 'x'] };
    for (let i = 1; i < 400; i += 1) picks[`shape-${i}`] = [1, i];
    const fitted = fitPreferences({ picks }, { deadKeys: [], growableMap: 'picks' });
    expect(Object.keys(fitted.picks as object)).not.toContain('broken');
    expect(Object.keys(fitted.picks as object)).not.toContain('odd');
  });

  it('answers what is left when trimming cannot make it fit', () => {
    quiet();
    const prefs = { big: 'x'.repeat(PREFERENCES_BODY_MAX * 2), picks: 'not a map' };
    expect(fitPreferences(prefs, { deadKeys: [], growableMap: 'picks' })).toEqual(prefs);
  });

  it('trims a worst-case map in linear time', () => {
    quiet();
    const picks: Record<string, [number, number]> = {};
    for (let i = 0; i < 20_000; i += 1) picks[`s${i}`] = [i, i];
    const ms = cpuMsOf(() => fitPreferences({ picks }, { deadKeys: [], growableMap: 'picks' }));
    expect(ms).toBeLessThan(500);
  });
});
