import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import { paletteCategoryOffered, paletteLandingCategory } from './palette-mode-categories';
import { tilesForCategory } from './palette-tile-defs';

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
      'popular',
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

  it('lands Diagram on Favourites and Infographic on Popular, each only in its own mode', () => {
    expect(paletteCategoryOffered('diagram', 'favourites')).toBe(true);
    expect(paletteCategoryOffered('diagram', 'popular')).toBe(false);
    expect(paletteCategoryOffered('infographic', 'popular')).toBe(true);
    expect(paletteCategoryOffered('infographic', 'favourites')).toBe(false);
    expect(paletteLandingCategory('diagram', false)).toBe('favourites');
    expect(paletteLandingCategory('infographic', false)).toBe('popular');
    expect(paletteLandingCategory('diagram', true)).toBe('event-storming');
  });

  it('picks twelve Popular tiles, every one from a category Infographic offers', () => {
    const tiles = tilesForCategory('popular');
    expect(tiles).toHaveLength(12);
    const reachable = new Set(
      offered('infographic')
        .filter((id) => id !== 'popular')
        .flatMap((id) => tilesForCategory(id).map((t) => t.id)),
    );
    for (const t of tiles) expect(reachable.has(t.id), t.id).toBe(true);
  });
});
