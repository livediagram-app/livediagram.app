// A tab folder's colour (docs/specs/006-document/tab-folders.md "Folder colour", "Tab bar rendering"): the hue chosen
// for it, else a stable pick from eight hues made from the folder's name.
import { describe, expect, it } from 'vitest';
import { TAB_FOLDER_COLOURS } from '@liveworkspace/api-schema/tab-folder-colour';
import {
  FOLDER_HUES,
  chosenFolderHue,
  folderHue,
  folderStyle,
  resolveFolderHue,
} from './folder-colour';

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
    expect(folderStyle(hue)).toEqual({ '--tf': hue.light, '--tfd': hue.dark });
  });
});

describe('a chosen colour', () => {
  it('names the stored hues, in their stored order', () => {
    expect(FOLDER_HUES.map((h) => h.name)).toEqual([...TAB_FOLDER_COLOURS]);
    expect(FOLDER_HUES.map((h) => h.label)).toEqual(
      TAB_FOLDER_COLOURS.map((n) => n[0]!.toUpperCase() + n.slice(1)),
    );
  });

  it('wins over the name, and an unknown or missing one is Automatic', () => {
    expect(chosenFolderHue('rose')?.name).toBe('rose');
    expect(chosenFolderHue('red')).toBeNull();
    expect(chosenFolderHue(undefined)).toBeNull();
    expect(resolveFolderHue('Planning', 'cyan').name).toBe('cyan');
    expect(resolveFolderHue('Planning', null)).toBe(folderHue('Planning'));
  });
});
