import { openerById } from './palette-openers';
import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  CATALOGUE_CATEGORIES,
  DIVIDE,
  PALETTE_LAYOUTS,
  paletteCategoriesFor,
  paletteCategoryOffered,
  paletteLandingCategory,
  participantTiles,
} from './palette-layouts';
import { tileById, tilesForCategory } from './palette-tile-defs';

// The palette per mode (docs/specs/007-editor/editor-modes.md "The palette per mode").
const ids = (mode: 'diagram' | 'draw' | 'workshop', esBoard = false) =>
  paletteCategoriesFor(mode, { esBoard }).map((c) => c.id);
const tileIds = (mode: 'diagram' | 'draw' | 'workshop', category: string) =>
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

  it('gives Diagram Popular, then every category but the mock-up kit, the charts and the session kit', () => {
    expect(ids('diagram')).toEqual([
      'popular',
      'shapes',
      'my-shapes',
      'write',
      'draw',
      'diagrams',
      'concepts',
      'layout',
      'icons',
      'technology',
      'media',
    ]);
  });

  // A headed note belongs to a diagram as much as a page (docs/specs/007-editor/editor-modes.md).
  it("puts the Callout in Diagram's Write, before the Comment panel", () => {
    const write = paletteCategoriesFor('diagram').find((c) => c.id === 'write')!;
    expect(write.tiles!.slice(-3)[0]!.id).toBe('components:callout');
  });

  it('offers every Data tile in Workshop', () => {
    const data = tilesForCategory('data').map((t) => t.id);
    expect(tileIds('workshop', 'data')).toEqual(data);
    // The Timeline is a concept graphic (docs/specs/009-elements/concept-graphics.md "Timeline"), in Concepts.
    expect(tileIds('diagram', 'concepts')).toContain('tools:timeline');
  });

  // Comments and assigned actions belong to every mode (docs/specs/012-collaboration/workshop-mode.md).
  it("keeps the Comment panel and the Action card at the end of Diagram's Write", () => {
    const write = paletteCategoriesFor('diagram').find((c) => c.id === 'write')!;
    expect(write.tiles!.slice(-2).map((t) => t.id)).toEqual([
      'collab:comment-pin',
      'collab:action-card',
    ]);
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
    expect(paletteLandingCategory('workshop', false)).toBe('popular');
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

  // A layout that drops a group's last tile keeps the group's end: Diagram and Workshop leave out the embeds,
  // whose Website ends Media's first group after Image, and Image ends it there instead.
  it("keeps Media's divider after Image where the embeds are left out", () => {
    for (const mode of ['diagram', 'workshop'] as const) {
      const media = paletteCategoriesFor(mode).find((c) => c.id === 'media')!;
      const ids = media.tiles!.map((t) => t.id);
      expect(ids, mode).not.toContain('media:embed-website');
      expect(media.tiles!.find((t) => t.id === 'tools:image')?.dividerAfter, mode).toBe(true);
      // Never one at the very end.
      expect(media.tiles!.at(-1)?.dividerAfter, mode).toBeFalsy();
    }
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

  it("leaves Page, Annotation, Shape Pen and Polygon out of Workshop's Write and Draw, and gives it Diagram's Layout", () => {
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
    // Diagram's Layout, with the Timeline after the containers: Workshop has no Concepts to find it in.
    const layout = tileIds('diagram', 'layout');
    expect(layout).not.toContain('tools:timeline');
    expect(tilesOf('layout')).toEqual([
      ...layout.slice(0, layout.indexOf('tools:boundary') + 1),
      'tools:timeline',
      ...layout.slice(layout.indexOf('tools:boundary') + 1),
    ]);
    expect(tilesOf('draw')).toEqual([
      'tools:pencil',
      'tools:highlighter',
      'tools:arrow',
      'tools:line',
    ]);
  });

  it('gives a Workshop Participant Sticky and Text, and an image', () => {
    expect(participantTiles('workshop', false).map((t) => t.id)).toEqual([
      'tools:sticky',
      'tools:text',
      'tools:image',
    ]);
  });

  it('offers Event Storming on a board only', () => {
    expect(ids('diagram', true)).toContain('event-storming');
    expect(paletteCategoryOffered('diagram', 'event-storming')).toBe(false);
  });

  it('lands every mode on its Popular, a board on its notation', () => {
    expect(paletteLandingCategory('diagram', false)).toBe('popular');
    expect(paletteLandingCategory('workshop', false)).toBe('popular');
    expect(paletteLandingCategory('diagram', true)).toBe('event-storming');
  });

  it('holds the same tile in different categories per mode: Page is in Write for Diagram only', () => {
    expect(tileIds('diagram', 'write')).toContain('tools:page');
    expect(tileIds('workshop', 'write')).not.toContain('tools:page');
  });

  // Every Popular tile is in another category of its mode too: the category bar has no Popular.
  it('offers every Popular tile in another category of its mode', () => {
    for (const mode of ['diagram', 'workshop'] as const) {
      const cats = paletteCategoriesFor(mode);
      const elsewhere = new Set(
        cats.filter((c) => c.id !== 'popular').flatMap((c) => (c.tiles ?? []).map((t) => t.id)),
      );
      for (const tile of cats.find((c) => c.id === 'popular')?.tiles ?? [])
        if (tile.action.type !== 'open')
          expect(elsewhere.has(tile.id), `${mode} ${tile.id}`).toBe(true);
    }
  });

  it('files the Sankey under Concepts, not Build, in Diagram', () => {
    expect(tileIds('diagram', 'concepts').at(-1)).toBe('tools:sankey');
    expect(tileIds('diagram', 'diagrams')).not.toContain('tools:sankey');
  });

  it("leaves Media's embeds out of Diagram, keeping its own two", () => {
    expect(tileIds('diagram', 'media')).toEqual(['tools:image', 'tools:avatar']);
  });

  it('defaults a category to its own tiles', () => {
    expect(tileIds('diagram', 'shapes')).toEqual(tilesForCategory('shapes').map((t) => t.id));
  });

  it("fills Diagram's Popular with the shapes, the structures and the AWS marks", () => {
    expect(tileIds('diagram', 'popular')).toEqual([
      'shapes:square',
      'shapes:circle',
      'shapes:diamond',
      'tools:text',
      'tools:arrow',
      'tools:frame',
      'tools:mind-node',
      'tools:flowchart',
      'tools:sankey',
      'tools:table',
      'open:technology/aws',
      'tools:entity',
    ]);
  });

  it('opens on Popular, or on the notation on an event-storming board', () => {
    expect(paletteLandingCategory('diagram', false)).toBe('popular');
    expect(paletteLandingCategory('diagram', true)).toBe('event-storming');
  });
});
