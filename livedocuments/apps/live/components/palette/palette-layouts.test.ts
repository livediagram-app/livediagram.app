import { openerById } from './palette-openers';
import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  CATALOGUE_CATEGORIES,
  DIVIDE,
  PALETTE_LAYOUTS,
  paletteCategoriesFor,
  paletteLandingCategory,
} from './palette-layouts';
import { tileById, tilesForCategory } from './palette-tile-defs';

// The palette per page kind (docs/specs/007-editor/pages-mode.md "The palette's kind").
const ids = () => paletteCategoriesFor('pages').map((c) => c.id);
const tileIds = (category: string) =>
  paletteCategoriesFor('pages')
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
        for (const t of e.tiles ?? [])
          if (t !== DIVIDE) expect(tileById(t) ?? openerById(t), `${mode}: ${t}`).toBeDefined();
        if (CATALOGUE_CATEGORIES.has(e.id)) expect(e.tiles, `${mode}: ${e.id}`).toBeUndefined();
      }
      expect(seen, `${mode} lands on one of its own`).toContain(layout.landing);
    }
  });

  it('offers every Data tile, adding the Table', () => {
    const data = tilesForCategory('data').map((t) => t.id);
    expect(tileIds('data')).toEqual([...data, 'tools:table']);
    // The Timeline is a concept graphic (docs/specs/009-elements/concept-graphics.md "Timeline"), in Concepts.
    expect(tileIds('concepts')).toContain('tools:timeline');
  });

  it('narrows Pages to the categories a visual page is made of', () => {
    expect(ids()).toEqual([
      'popular',
      'shapes',
      'write',
      'concepts',
      'components',
      'devices',
      'icons',
      'stickers',
      'media',
      'data',
    ]);
  });

  it('lands on Popular', () => {
    expect(paletteLandingCategory('pages')).toBe('popular');
  });

  it('files the Sankey last in Concepts, and keeps Write to its notes', () => {
    expect(tileIds('concepts').at(-1)).toBe('tools:sankey');
    expect(tileIds('write')).toEqual(['tools:text', 'tools:sticky', 'tools:pointer-note']);
  });

  it('leaves mind nodes, lanes, frames and entities out of Pages', () => {
    const everywhere = paletteCategoriesFor('pages').flatMap((c) =>
      (c.tiles ?? []).map((t) => t.id),
    );
    for (const id of ['tools:mind-node', 'tools:lane', 'tools:entity']) {
      expect(everywhere, id).not.toContain(id);
    }
    // No Build: its three page tiles sit in Components and Data.
    expect(ids()).not.toContain('build');
    // Components leads with its Layout group: the Hero, Header and Banner, then the Stack.
    expect(tileIds('components').slice(0, 4)).toEqual([
      'components:hero',
      'components:header',
      'components:banner',
      'tools:stack',
    ]);
  });

  it('picks twelve Popular tiles, each reachable from another Pages category', () => {
    const popular = tileIds('popular');
    expect(popular).toHaveLength(12);
    const reachable = new Set(
      paletteCategoriesFor('pages')
        .filter((c) => c.id !== 'popular')
        .flatMap((c) => (c.tiles ?? []).map((t) => t.id)),
    );
    for (const id of popular) expect(reachable.has(id), id).toBe(true);
  });

  it('gives a slide page words, shapes and media first, then what makes a point (pages-mode.md)', () => {
    const slide = paletteCategoriesFor('pages', { pagesKind: 'slide' });
    expect(slide.map((c) => c.id)).toEqual([
      'popular',
      'write',
      'shapes',
      'media',
      'data',
      'concepts',
      'components',
      'devices',
      'icons',
      'stickers',
    ]);
    expect(slide.find((c) => c.id === 'media')!.group).toBe(0);
    expect(slide.find((c) => c.id === 'components')!.tiles!.map((t) => t.id)).not.toContain(
      'components:header',
    );
  });
});

// docs/specs/007-editor/pages-mode.md "The palette's kind": each kind's tiles in one category each.
describe('the Pages kinds', () => {
  it.each(['design', 'slide', 'article'] as const)(
    'shares no tile between two categories in %s, Popular aside',
    (kind) => {
      const seen = new Map<string, string>();
      for (const c of paletteCategoriesFor('pages', { pagesKind: kind })) {
        if (c.id === 'popular') continue;
        for (const t of c.tiles ?? []) {
          expect(seen.get(t.id), `${t.id} in ${c.id}`).toBeUndefined();
          seen.set(t.id, c.id);
        }
      }
    },
  );

  it('fills each kind’s Popular from its own categories', () => {
    for (const kind of ['design', 'slide', 'article'] as const) {
      const cats = paletteCategoriesFor('pages', { pagesKind: kind });
      const popular = cats.find((c) => c.id === 'popular')!.tiles!.map((t) => t.id);
      const rest = new Set(
        cats.filter((c) => c.id !== 'popular').flatMap((c) => (c.tiles ?? []).map((t) => t.id)),
      );
      for (const id of popular) expect(rest.has(id), `${kind}: ${id}`).toBe(true);
    }
  });
});
