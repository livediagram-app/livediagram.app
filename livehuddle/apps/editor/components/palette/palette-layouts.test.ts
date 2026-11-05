import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  CATALOGUE_CATEGORIES,
  DIVIDE,
  PALETTE_LAYOUTS,
  SEARCH_ONLY_TILE_IDS,
  paletteCategoriesFor,
  paletteCategoryOffered,
  paletteLandingCategory,
  participantTiles,
} from './palette-layouts';
import { tileById, tilesForCategory } from './palette-tile-defs';

// The meeting palette (docs/specs/012-collaboration/workshop-mode.md "The palette"), livehuddle's one palette.
const ids = () => paletteCategoriesFor('workshop').map((c) => c.id);
const tileIds = (category: string) =>
  paletteCategoriesFor('workshop')
    .find((c) => c.id === category)!
    .tiles!.map((t) => t.id);
const allTiles = () =>
  paletteCategoriesFor('workshop').flatMap((c) => (c.tiles ?? []).map((t) => t.id));

describe('palette layouts', () => {
  it('name only known categories, once each, and only known tiles', () => {
    const known = new Set(PALETTE_CATEGORIES.map((c) => c.id));
    for (const [mode, layout] of Object.entries(PALETTE_LAYOUTS)) {
      const seen = layout.categories.map((e) => e.id);
      expect(new Set(seen).size, mode).toBe(seen.length);
      for (const e of layout.categories) {
        expect(known.has(e.id), `${mode}: ${e.id}`).toBe(true);
        for (const t of e.tiles ?? [])
          if (t !== DIVIDE) expect(tileById(t), `${mode}: ${t}`).toBeDefined();
        if (CATALOGUE_CATEGORIES.has(e.id)) expect(e.tiles, `${mode}: ${e.id}`).toBeUndefined();
      }
      expect(seen, `${mode} lands on one of its own`).toContain(layout.landing);
    }
  });

  it('is Popular; Write, Frame; Navigate, React, Selection Mode; Icons, Stickers, Media', () => {
    expect(ids()).toEqual([
      'popular',
      'write',
      'frame',
      'collab-navigate',
      'collab-react',
      'collab-mode',
      'icons',
      'stickers',
      'media',
    ]);
    expect(paletteLandingCategory('workshop')).toBe('popular');
    // No opener anywhere: every category is one level deep.
    for (const c of paletteCategoriesFor('workshop'))
      for (const t of c.tiles ?? []) expect(t.action.type, t.id).not.toBe('open');
  });

  it('lands on Popular: the light content, then the pieces a meeting place is built from', () => {
    expect(tileIds('popular')).toEqual([
      'tools:sticky',
      'tools:text',
      'tools:frame',
      'tools:image',
      'tools:link-card',
      'tools:room',
      'tools:meeting-table',
      'tools:chair',
      'tools:focus-button',
      'tools:avatar-pad',
    ]);
    const popular = paletteCategoriesFor('workshop').find((c) => c.id === 'popular')!;
    expect(popular.tiles!.filter((t) => t.dividerAfter).map((t) => t.id)).toEqual([
      'tools:link-card',
    ]);
  });

  it('holds only light content in Write, Frame and Media', () => {
    expect(tileIds('write')).toEqual(['tools:text', 'tools:sticky']);
    expect(tileIds('frame')).toEqual(['tools:frame']);
    expect(tileIds('media')).toEqual(['tools:image', 'tools:link-card']);
  });

  it('puts the places, the furniture and then the office pieces in Navigate', () => {
    expect(tileIds('collab-navigate')).toEqual([
      'tools:door',
      'tools:focus-button',
      'tools:chair',
      'tools:desk',
      'tools:sofa',
      'tools:fence',
      'tools:avatar-pad',
      'tools:link-card',
      'tools:room',
      'tools:stage',
      'tools:meeting-table',
      'tools:plant',
      'tools:bookshelf',
      'tools:water-cooler',
      'tools:coffee-machine',
      'tools:rug',
    ]);
  });

  it('keeps the five Reaction Pads and every Selection Mode button', () => {
    expect(tileIds('collab-react')).toEqual(tilesForCategory('collab-react').map((t) => t.id));
    expect(tileIds('collab-react')).toHaveLength(5);
    expect(tileIds('collab-mode')).toEqual(tilesForCategory('collab-mode').map((t) => t.id));
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "What leaves": offered from nowhere.
  it('offers no diagram tool, no Collaborate element and no Session button', () => {
    const offered = new Set(allTiles());
    for (const leaving of [
      'shapes:square',
      'tools:arrow',
      'tools:line',
      'tools:pencil',
      'tools:highlighter',
      'tools:pointer-note',
      'tools:table',
      'tools:checklist',
      'tools:lane',
      'tools:timeline',
      'tools:session-timer',
      'tools:session-vote',
      'tools:session-poll',
      'tools:reveal',
      'collab:agenda',
      'collab:qa-board',
      'collab:temperature',
      'collab:idea-box',
    ])
      expect(offered.has(leaving), leaving).toBe(false);
    for (const gone of [
      'shapes',
      'my-shapes',
      'draw',
      'layout',
      'data',
      'collab-ask',
      'collab-tools',
      'collab-record',
    ])
      expect(paletteCategoryOffered('workshop', gone), gone).toBe(false);
    expect(SEARCH_ONLY_TILE_IDS).toEqual([]);
  });

  it('gives a Participant Sticky and Text, and an image', () => {
    expect(participantTiles().map((t) => t.id)).toEqual([
      'tools:sticky',
      'tools:text',
      'tools:image',
    ]);
  });
});
