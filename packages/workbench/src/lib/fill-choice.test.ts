// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { FILL_TRANSPARENT, loadFillChoice, parseFillChoice, saveFillChoice } from './fill-choice';

afterEach(() => window.localStorage.clear());

describe('fill choice', () => {
  it('reads a hex colour or Transparent, and null (the default) for anything else', () => {
    expect(parseFillChoice('#DBEAFE')).toBe('#dbeafe');
    expect(parseFillChoice(FILL_TRANSPARENT)).toBe(FILL_TRANSPARENT);
    expect(parseFillChoice('#fff')).toBeNull();
    expect(parseFillChoice('blue')).toBeNull();
    expect(parseFillChoice(3)).toBeNull();
    expect(parseFillChoice(null)).toBeNull();
  });

  it('round-trips through this browser under the key it is given, never storing junk', () => {
    expect(loadFillChoice('k')).toBeNull();
    saveFillChoice('k', '#123456');
    expect(loadFillChoice('k')).toBe('#123456');
    saveFillChoice('k', FILL_TRANSPARENT);
    expect(loadFillChoice('k')).toBe(FILL_TRANSPARENT);
    saveFillChoice('k', 'nonsense');
    expect(loadFillChoice('k')).toBe(FILL_TRANSPARENT);
    window.localStorage.setItem('k', 'nonsense');
    expect(loadFillChoice('k')).toBeNull();
  });
});
