// A tab folder's colour (docs/specs/006-document/tab-folders.md "Tab bar rendering"): a stable pick from eight hues,
// from the folder's name, with nothing stored.
import { describe, expect, it } from 'vitest';
import { FOLDER_HUES, folderHue, folderStyle } from './folder-colour';

describe('folderHue', () => {
  it('gives a name the same hue every time', () => {
    expect(folderHue('Planning')).toBe(folderHue('Planning'));
    expect(folderHue('')).toBe(folderHue(''));
  });

  it('picks from the eight hues, each with a light and a dark ink', () => {
    expect(FOLDER_HUES).toHaveLength(8);
    for (const hue of FOLDER_HUES) {
      expect(hue.light).toMatch(/^#[0-9a-f]{6}$/);
      expect(hue.dark).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(FOLDER_HUES).toContain(folderHue('Engineering'));
  });

  it('spreads everyday names across the hues', () => {
    const names = [
      'Planning',
      'Engineering',
      'Design',
      'Research',
      'Marketing',
      'Sales',
      'Ops',
      'Q1',
      'Q2',
      'Archive',
    ];
    const used = new Set(names.map((n) => folderHue(n).name));
    expect(used.size).toBeGreaterThanOrEqual(5);
  });
});

describe('folderStyle', () => {
  it('sets the light and dark inks as CSS variables', () => {
    const hue = folderHue('Planning');
    expect(folderStyle('Planning')).toEqual({ '--tf': hue.light, '--tfd': hue.dark });
  });
});
