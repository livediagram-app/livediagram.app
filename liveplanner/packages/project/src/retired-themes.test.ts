import { describe, expect, it } from 'vitest';
import { migrateRetiredTheme } from './retired-themes';
import { migrateStoredTab } from './stored-tab';
import { THEMES } from './themes-data';
import type { Element } from './index';

const box = (extra: Record<string, unknown>) =>
  ({
    id: 'a',
    type: 'shape',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...extra,
  }) as unknown as Element;

describe('retired themes (docs/specs/011-theme/light-and-dark.md "Retired: Autumn and Jewel")', () => {
  it('are gone from the catalogue', () => {
    expect(THEMES.map((t) => t.id)).not.toContain('autumn');
    expect(THEMES.map((t) => t.id)).not.toContain('jewel');
  });

  it('moves Autumn to Tropical, its colours to the same roles', () => {
    const out = migrateRetiredTheme({
      theme: 'autumn',
      backgroundColor: '#fffaf5',
      patternColor: '#fed7aa',
      elements: [box({ fillColor: '#fee2e2', strokeColor: '#dc2626', textColor: '#7f1d1d' })],
    });
    expect(out.theme).toBe('tropical');
    expect(out.backgroundColor).toBe('#f0fdfa');
    expect(out.patternColor).toBe('#99f6e4');
    expect(out.elements[0]).toMatchObject({
      fillColor: '#ccfbf1',
      strokeColor: '#0d9488',
      textColor: '#134e4a',
    });
  });

  it('moves Jewel to Rainbow and keeps a colour someone picked', () => {
    const out = migrateRetiredTheme({
      theme: 'jewel',
      backgroundColor: '#fbfbfd',
      patternColor: '#e2e8f0',
      elements: [box({ fillColor: '#123456', strokeColor: '#334155' })],
    });
    expect(out.theme).toBe('rainbow');
    expect(out.elements[0]).toMatchObject({ fillColor: '#123456', strokeColor: '#475569' });
  });

  it('leaves any other tab as it is, and runs on every stored-tab read', () => {
    const tab = {
      theme: 'tropical',
      backgroundColor: '#f0fdfa',
      patternColor: '#99f6e4',
      elements: [],
    };
    expect(migrateRetiredTheme(tab)).toBe(tab);
    expect(migrateStoredTab({ ...tab, theme: 'jewel' }).theme).toBe('rainbow');
  });
});
