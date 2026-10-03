import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  CATALOGUE_CATEGORIES,
  PALETTE_LAYOUTS,
  paletteCategoriesFor,
  paletteCategoryOffered,
  paletteLandingCategory,
} from './palette-layouts';
import { tileById, tilesForCategory } from './palette-tile-defs';

// The palette per mode (docs/specs/007-editor/editor-modes.md "The palette per mode").
const ids = (mode: 'diagram' | 'infographic', esBoard = false) =>
  paletteCategoriesFor(mode, { esBoard }).map((c) => c.id);
const tileIds = (mode: 'diagram' | 'infographic', category: string) =>
  paletteCategoriesFor(mode)
    .find((c) => c.id === category)!
    .tiles!.map((t) => t.id);

describe('palette layouts', () => {
  it('name only known categories, once each, and only known tiles', () => {
    const known = new Set(PALETTE_CATEGORIES.map((c) => c.id));
    for (const [mode, layout] of Object.entries(PALETTE_LAYOUTS)) {
      const seen = layout.categories.map((e) => e.id);
      expect(new Set(seen).size, mode).toBe(seen.length);
      for (const e of layout.categories) {
        expect(known.has(e.id), `${mode}: ${e.id}`).toBe(true);
        for (const t of e.tiles ?? []) expect(tileById(t), `${mode}: ${t}`).toBeDefined();
        if (CATALOGUE_CATEGORIES.has(e.id)) expect(e.tiles, `${mode}: ${e.id}`).toBeUndefined();
      }
      expect(seen, `${mode} lands on one of its own`).toContain(layout.landing);
    }
  });

  it('gives Diagram every category but the mock-up kit, the charts and Popular', () => {
    expect(ids('diagram')).toEqual([
      'favourites',
      'shapes',
      'my-shapes',
      'write',
      'draw',
      'build',
      'icons',
      'stickers',
      'technology',
      'media',
      'behaviour',
    ]);
  });

  it('offers Event Storming on a board only', () => {
    expect(ids('diagram', true)).toContain('event-storming');
    expect(paletteCategoryOffered('diagram', 'event-storming')).toBe(false);
  });

  it('narrows Infographic to the categories a visual page is made of', () => {
    expect(ids('infographic')).toEqual([
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

  it('lands Diagram on Favourites, Infographic on Popular, a board on its notation', () => {
    expect(paletteLandingCategory('diagram', false)).toBe('favourites');
    expect(paletteLandingCategory('infographic', false)).toBe('popular');
    expect(paletteLandingCategory('diagram', true)).toBe('event-storming');
  });

  it('holds the same tile in different categories per mode: Page is in Write for Diagram only', () => {
    expect(tileIds('diagram', 'write')).toContain('tools:page');
    expect(tileIds('infographic', 'write')).not.toContain('tools:page');
    expect(tileIds('infographic', 'write')).toEqual(['tools:text', 'tools:sticky']);
  });

  it('leaves mind nodes, lanes, frames, annotations and entities out of Infographic', () => {
    const everywhere = paletteCategoriesFor('infographic').flatMap((c) =>
      (c.tiles ?? []).map((t) => t.id),
    );
    for (const id of [
      'tools:mind-node',
      'tools:lane',
      'tools:frame',
      'tools:annotation',
      'tools:entity',
    ]) {
      expect(everywhere, id).not.toContain(id);
    }
    expect(tileIds('infographic', 'build')).toEqual(['tools:table', 'tools:timeline']);
    expect(tileIds('diagram', 'build')).toContain('tools:mind-node');
    expect(tileIds('diagram', 'write')).toContain('tools:annotation');
  });

  it("leaves Media's embeds out of Diagram, keeping its own two", () => {
    expect(tileIds('diagram', 'media')).toEqual(['tools:image', 'tools:avatar']);
    expect(tileIds('infographic', 'media')).toContain('media:embed-youtube');
  });

  it('defaults a category to its own tiles', () => {
    expect(tileIds('diagram', 'shapes')).toEqual(tilesForCategory('shapes').map((t) => t.id));
  });

  it('picks twelve Popular tiles, each reachable from another Infographic category', () => {
    const popular = tileIds('infographic', 'popular');
    expect(popular).toHaveLength(12);
    const reachable = new Set(
      paletteCategoriesFor('infographic')
        .filter((c) => c.id !== 'popular')
        .flatMap((c) => (c.tiles ?? []).map((t) => t.id)),
    );
    for (const id of popular) expect(reachable.has(id), id).toBe(true);
  });
});
