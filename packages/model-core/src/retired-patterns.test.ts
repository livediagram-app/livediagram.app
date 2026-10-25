import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindRetiredPatterns } from './retired-patterns';

const retired = bindRetiredPatterns({ isometric: 'crosshatch' });

describe('bindRetiredPatterns', () => {
  afterEach(() => vi.restoreAllMocks());

  it('offers every pattern but the retired ones', () => {
    expect(retired.isOffered('grid')).toBe(true);
    expect(retired.isOffered('crosshatch')).toBe(true);
    expect(retired.isOffered('isometric')).toBe(false);
    expect(retired.isOffered('not-a-pattern')).toBe(false);
    expect(retired.isOffered(undefined)).toBe(false);
  });

  it('moves a tab off a retired pattern onto its replacement, with a log', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const tab = { id: 't1', backgroundPattern: 'isometric', patternColor: '#ccc' };
    expect(retired.migrate(tab)).toEqual({
      id: 't1',
      backgroundPattern: 'crosshatch',
      patternColor: '#ccc',
    });
    expect(info).toHaveBeenCalledWith('[tab-migrate] retired-pattern', {
      from: 'isometric',
      to: 'crosshatch',
    });
  });

  it('hands back the same tab when it wears no retired pattern', () => {
    for (const tab of [{ backgroundPattern: 'grid' }, {}, { backgroundPattern: 42 }]) {
      expect(retired.migrate(tab)).toBe(tab);
    }
  });

  it('never treats an inherited key as retired', () => {
    expect(retired.isOffered('toString')).toBe(false);
    const tab = { backgroundPattern: 'toString' };
    expect(retired.migrate(tab)).toBe(tab);
  });
});
