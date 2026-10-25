import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  CATALOGUE_CATEGORIES,
  DIVIDE,
  PALETTE_LAYOUTS,
  paletteCategoriesFor,
} from './palette-layouts';
import { tileById, tilesForCategory } from './palette-tile-defs';

// The palette per page kind (docs/specs/007-editor/pages-mode.md "The palette's kind").
const ids = () => paletteCategoriesFor().map((c) => c.id);
const tileIds = (category: string) =>
  paletteCategoriesFor()
    .find((c) => c.id === category)!
    .tiles!.map((t) => t.id);

describe('palette layouts', () => {
  it('name only known categories, once each, and only known tiles', () => {
    const known = new Set(PALETTE_CATEGORIES.map((c) => c.id));
    for (const [kind, layout] of Object.entries(PALETTE_LAYOUTS)) {
      const seen = layout.categories.map((e) => e.id);
      expect(new Set(seen).size, kind).toBe(seen.length);
      for (const e of layout.categories) {
        expect(known.has(e.id), `${kind}: ${e.id}`).toBe(true);
        for (const t of e.tiles ?? [])
          if (t !== DIVIDE) expect(tileById(t), `${kind}: ${t}`).toBeDefined();
        if (CATALOGUE_CATEGORIES.has(e.id)) expect(e.tiles, `${kind}: ${e.id}`).toBeUndefined();
      }
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

  it('files the Sankey last in Concepts, and keeps Write to its notes', () => {
    expect(tileIds('concepts').at(-1)).toBe('tools:sankey');
    expect(tileIds('write')).toEqual(['tools:text', 'tools:sticky', 'tools:pointer-note']);
  });

  it('leaves mind nodes, lanes, frames and entities out of Pages', () => {
    const everywhere = paletteCategoriesFor().flatMap((c) => (c.tiles ?? []).map((t) => t.id));
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

  it('gives a slide page words, shapes and media first, then what makes a point (pages-mode.md)', () => {
    const slide = paletteCategoriesFor({ pagesKind: 'slide' });
    expect(slide.map((c) => c.id)).toEqual([
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
    'shares no tile between two categories in %s',
    (kind) => {
      const seen = new Map<string, string>();
      for (const c of paletteCategoriesFor({ pagesKind: kind })) {
        for (const t of c.tiles ?? []) {
          expect(seen.get(t.id), `${t.id} in ${c.id}`).toBeUndefined();
          seen.set(t.id, c.id);
        }
      }
    },
  );
});
