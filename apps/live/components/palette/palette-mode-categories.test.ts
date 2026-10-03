import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import { paletteCategoryOffered } from './palette-mode-categories';

// The palette per mode (docs/specs/007-editor/editor-modes.md "The palette per mode").
const offered = (mode: 'diagram' | 'infographic') =>
  PALETTE_CATEGORIES.map((c) => c.id).filter((id) => paletteCategoryOffered(mode, id));

describe('paletteCategoryOffered', () => {
  it('leaves the mock-up kit out of Diagram mode', () => {
    expect(offered('diagram')).not.toContain('components');
    expect(offered('diagram')).not.toContain('devices');
    expect(offered('diagram')).toContain('technology');
    expect(offered('diagram')).toContain('data');
  });

  it('narrows Infographic mode to the categories a visual page is made of, in band order', () => {
    expect(offered('infographic')).toEqual([
      'favourites',
      'shapes',
      'my-shapes',
      'write',
      'build',
      'components',
      'devices',
      'icons',
      'stickers',
      'media',
      'data',
    ]);
  });

  it('keeps Favourites in every mode', () => {
    expect(paletteCategoryOffered('diagram', 'favourites')).toBe(true);
    expect(paletteCategoryOffered('infographic', 'favourites')).toBe(true);
  });
});
