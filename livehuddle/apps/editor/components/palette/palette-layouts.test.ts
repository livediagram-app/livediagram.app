import { openerById } from './palette-openers';
import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  CATALOGUE_CATEGORIES,
  DIVIDE,
  PALETTE_LAYOUTS,
  paletteCategoriesFor,
  paletteLandingCategory,
  participantTiles,
} from './palette-layouts';
import { tileById, tilesForCategory } from './palette-tile-defs';

// The palette per mode (docs/specs/007-editor/editor-modes.md "The palette per mode").
const ids = (mode: 'workshop') => paletteCategoriesFor(mode).map((c) => c.id);
const tileIds = (mode: 'workshop', category: string) =>
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
        for (const t of e.tiles ?? [])
          if (t !== DIVIDE) expect(tileById(t) ?? openerById(t), `${mode}: ${t}`).toBeDefined();
        if (CATALOGUE_CATEGORIES.has(e.id)) expect(e.tiles, `${mode}: ${e.id}`).toBeUndefined();
      }
      expect(seen, `${mode} lands on one of its own`).toContain(layout.landing);
    }
  });

  it('offers every Data tile in Workshop', () => {
    const data = tilesForCategory('data').map((t) => t.id);
    expect(tileIds('workshop', 'data')).toEqual(data);
  });

  // Workshop mode (docs/specs/012-collaboration/workshop-mode.md "The palette").
  it('gives Workshop Popular, the drawing basics, Layout, the six Collaborate categories, the decorations and the charts', () => {
    expect(ids('workshop')).toEqual([
      'popular',
      'shapes',
      'my-shapes',
      'write',
      'draw',
      'layout',
      'collab-ask',
      'collab-tools',
      'collab-record',
      'collab-react',
      'collab-mode',
      'collab-navigate',
      'icons',
      'stickers',
      'media',
      'data',
    ]);
    expect(paletteLandingCategory('workshop')).toBe('popular');
  });

  it("puts the session kit on Workshop's Popular as four openers", () => {
    const popular = paletteCategoriesFor('workshop').find((c) => c.id === 'popular')!;
    expect(popular.tiles!.map((t) => t.id)).toEqual([
      'shapes:square',
      'tools:sticky',
      'tools:text',
      'tools:frame',
      'tools:arrow',
      'tools:image',
      'open:collab-ask',
      'open:collab-tools',
      'open:collab-record',
      'open:collab-react',
    ]);
    // A divider of its own between the tiles and the openers, here only.
    expect(popular.tiles!.filter((t) => t.dividerAfter).map((t) => t.id)).toContain('tools:image');
    // Each opens a category Workshop offers.
    const offered = new Set(paletteCategoriesFor('workshop').map((c) => c.id));
    for (const t of popular.tiles!)
      if (t.action.type === 'open') expect(offered.has(t.action.category), t.id).toBe(true);
  });

  it('holds every Collaborate tile in Workshop, across its six categories', () => {
    const held = paletteCategoriesFor('workshop')
      .filter((c) => c.id.startsWith('collab-'))
      .flatMap((c) => c.tiles!.map((t) => t.id));
    expect(held.sort()).toEqual(
      tilesForCategory('behaviour')
        .map((t) => t.id)
        .sort(),
    );
  });

  it("leaves Page, Annotation, Shape Pen and Polygon out of Workshop's Write and Draw, and puts the Timeline in Layout", () => {
    const tilesOf = (id: string) =>
      paletteCategoriesFor('workshop')
        .find((c) => c.id === id)!
        .tiles!.map((t) => t.id);
    const write = paletteCategoriesFor('workshop').find((c) => c.id === 'write')!;
    expect(write.label).toBe('Write');
    expect(tilesOf('write')).toEqual([
      'tools:text',
      'tools:sticky',
      'tools:pointer-note',
      'tools:table',
      'tools:checklist',
    ]);
    // The Timeline after the containers.
    const layout = tilesOf('layout');
    expect(layout.indexOf('tools:timeline')).toBe(layout.indexOf('tools:boundary') + 1);
    expect(tilesOf('draw')).toEqual([
      'tools:pencil',
      'tools:highlighter',
      'tools:arrow',
      'tools:line',
    ]);
  });

  it('gives a Workshop Participant Sticky and Text, and an image', () => {
    expect(participantTiles().map((t) => t.id)).toEqual([
      'tools:sticky',
      'tools:text',
      'tools:image',
    ]);
  });

  it('defaults a category to its own tiles', () => {
    expect(tileIds('workshop', 'shapes')).toEqual(tilesForCategory('shapes').map((t) => t.id));
  });
});
