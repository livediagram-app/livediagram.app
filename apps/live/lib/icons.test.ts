import { describe, expect, it } from 'vitest';
import { DEFAULT_ICON_ID, ICON_CATALOG, PLACEHOLDER_ICON, getIcon, searchIcons } from './icons';

describe('icon catalogue', () => {
  it('is non-empty and has unique ids', () => {
    expect(ICON_CATALOG.length).toBeGreaterThan(0);
    const ids = ICON_CATALOG.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every icon has a label and at least one primitive', () => {
    for (const icon of ICON_CATALOG) {
      expect(icon.label.length).toBeGreaterThan(0);
      expect(icon.prims.length).toBeGreaterThan(0);
    }
  });

  it('DEFAULT_ICON_ID resolves to a catalogue entry', () => {
    expect(ICON_CATALOG.some((i) => i.id === DEFAULT_ICON_ID)).toBe(true);
  });
});

describe('getIcon', () => {
  it('returns the matching icon for a known id', () => {
    expect(getIcon('server').id).toBe('server');
  });

  it('falls back to the placeholder for unknown / missing ids', () => {
    expect(getIcon('does-not-exist')).toBe(PLACEHOLDER_ICON);
    expect(getIcon(undefined)).toBe(PLACEHOLDER_ICON);
  });
});

describe('searchIcons', () => {
  it('returns the whole catalogue for an empty / whitespace query', () => {
    expect(searchIcons('')).toHaveLength(ICON_CATALOG.length);
    expect(searchIcons('   ')).toHaveLength(ICON_CATALOG.length);
  });

  it('matches on label case-insensitively', () => {
    expect(searchIcons('SERVER').some((i) => i.id === 'server')).toBe(true);
  });

  it('matches on keywords beyond the label', () => {
    // 'database' carries the keyword 'db'.
    expect(searchIcons('db').some((i) => i.id === 'database')).toBe(true);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchIcons('zzzznotanicon')).toEqual([]);
  });
});
