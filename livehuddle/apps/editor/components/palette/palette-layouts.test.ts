import { describe, expect, it } from 'vitest';
import { PALETTE_CATEGORIES } from './palette-categories';
import {
  CATALOGUE_CATEGORIES,
  DIVIDE,
  MEETING_PALETTE,
  SEARCH_ONLY_TILE_IDS,
  paletteCategories,
  paletteCategoryOffered,
  paletteLandingCategory,
} from './palette-layouts';
import { tileById, tilesForCategory } from './palette-tile-defs';
import { SPACE_CATEGORIES } from './space-categories';

// The meeting palette (docs/specs/012-collaboration/workshop-mode.md "The palette"), livehuddle's one palette.
const ids = () => paletteCategories().map((c) => c.id);
const tileIds = (category: string) =>
  paletteCategories()
    .find((c) => c.id === category)!
    .tiles!.map((t) => t.id);
const allTiles = () => paletteCategories().flatMap((c) => (c.tiles ?? []).map((t) => t.id));

describe('palette layouts', () => {
  it('name only known categories, once each, and only known tiles', () => {
    const known = new Set(PALETTE_CATEGORIES.map((c) => c.id));
    for (const [mode, layout] of Object.entries({ meeting: MEETING_PALETTE })) {
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

  it('is Popular; Write; the Space categories, Travel last; Stickers, Media (no Icons)', () => {
    expect(ids()).toEqual([
      'popular',
      'write',
      'collab-rooms',
      'collab-seating',
      'collab-amenities',
      'collab-bar',
      'collab-recreation',
      'collab-garden',
      'collab-meeting',
      'collab-travel',
      'stickers',
    ]);
    expect(paletteLandingCategory()).toBe('popular');
    // No opener anywhere: every category is one level deep.
    for (const c of paletteCategories())
      for (const t of c.tiles ?? []) expect(t.action.type, t.id).not.toBe('open');
  });

  it('lands on Popular: the light content, then the pieces a meeting place is built from', () => {
    expect(tileIds('popular')).toEqual([
      'tools:sticky',
      'tools:text',
      'tools:room',
      'tools:meeting-table',
      'tools:chair',
      'tools:focus-button',
      'tools:avatar-pad',
    ]);
    const popular = paletteCategories().find((c) => c.id === 'popular')!;
    expect(popular.tiles!.filter((t) => t.dividerAfter).map((t) => t.id)).toEqual(['tools:text']);
  });

  it('holds only light content in Write, and offers no Image or Link card anywhere (not-in-livehuddle.md "Media")', () => {
    expect(tileIds('write')).toEqual(['tools:text', 'tools:sticky']);
    expect(paletteCategoryOffered('media')).toBe(false);
    for (const c of paletteCategories())
      for (const t of c.tiles ?? [])
        expect(['tools:image', 'tools:link-card'], c.id).not.toContain(t.id);
  });

  // docs/specs/010-palette/palette-top-level-categories.md "The Space categories".
  it('splits the Space pieces into their categories', () => {
    expect(tileIds('collab-travel')).toEqual([
      'tools:door',
      'tools:focus-button',
      'tools:avatar-pad',
      'tools:directory',
      'tools:elevator',
      'tools:mode-avatar',
    ]);
    expect(tileIds('collab-seating')).toEqual([
      'tools:chair',
      'tools:desk',
      'tools:sofa',
      'tools:meeting-table',
      'tools:bean-bag',
      'tools:reading-nook',
    ]);
    // Rooms opens on Build (docs/specs/010-palette/palette-top-level-categories.md "Rooms opens on Build"): Room,
    // Room Builder and Door, a divider, then the rest of the rooms pieces in catalogue order, each once.
    expect(tileIds('collab-rooms')).toEqual([
      'tools:room',
      'tools:room-builder',
      'tools:wall-door',
      'tools:fence',
      'tools:stage',
      'tools:office-pod',
      'tools:rug',
    ]);
    const rooms = paletteCategories().find((c) => c.id === 'collab-rooms')!;
    expect(rooms.tiles!.filter((t) => t.dividerAfter).map((t) => t.id)).toEqual([
      'tools:wall-door',
    ]);
    // Amenities in three named groups (docs/specs/009-elements/office-amenities.md "Where they live").
    expect(tileIds('collab-amenities')).toEqual([
      'tools:plant',
      'tools:bookshelf',
      'tools:printer',
      'tools:copier',
      'tools:lockers',
      'tools:coat-rack',
      'tools:umbrella-stand',
      'tools:water-cooler',
      'tools:coffee-machine',
      'tools:vending-machine',
      'tools:kitchen-counter',
      'tools:kitchen-sink',
      'tools:fridge',
      'tools:microwave',
      'tools:kettle',
      'tools:restroom',
      'tools:toilet-cubicle',
      'tools:washbasin',
      'tools:hand-dryer',
    ]);
    const amenities = paletteCategories().find((c) => c.id === 'collab-amenities')!;
    expect(amenities.tiles!.filter((t) => t.dividerAfter).map((t) => t.id)).toEqual([
      'tools:umbrella-stand',
      'tools:kettle',
    ]);
    expect(tileIds('collab-recreation')).toEqual([
      'tools:jukebox',
      'tools:ping-pong-table',
      'tools:pool-table',
      'tools:foosball-table',
      'tools:arcade-machine',
      'tools:dartboard',
      'tools:fireplace',
    ]);
    expect(tileIds('collab-meeting')).toEqual([
      'tools:screen',
      'tools:room-sign',
      'tools:notice-board',
      'tools:world-clock',
      // docs/specs/009-elements/timer-and-stopwatch.md: placed in a room, not a cluster button.
      'tools:timer',
      'tools:stopwatch',
    ]);
  });

  it('files each Space piece in exactly one category, by its tileGroup', () => {
    for (const c of SPACE_CATEGORIES)
      for (const t of tilesForCategory(c.id)) expect(t.tileGroup, t.id).toBe(c.tileGroup);
    const pieces = SPACE_CATEGORIES.flatMap((c) => tilesForCategory(c.id).map((t) => t.id));
    expect(new Set(pieces).size).toBe(pieces.length);
    // The meeting layout's Space categories hold every piece once too, Rooms' Build group included.
    const offered = paletteCategories()
      .filter((c) => c.id.startsWith('collab-'))
      .flatMap((c) => (c.tiles ?? []).map((t) => t.id));
    expect([...offered].sort()).toEqual([...pieces].sort());
  });

  it('leaves a Space category off until it holds a tile', () => {
    for (const c of SPACE_CATEGORIES)
      expect(paletteCategoryOffered(c.id), c.id).toBe(tilesForCategory(c.id).length > 0);
  });

  // docs/specs/009-elements/mode-button.md "Only Avatar": no Selection Mode category; the Avatar button is in Travel.
  it('keeps only the Avatar Selection Mode button, in Travel', () => {
    expect(paletteCategoryOffered('collab-mode')).toBe(false);
    expect(tileIds('collab-travel')).toContain('tools:mode-avatar');
    const modeButtons = allTiles().filter((id) => id.startsWith('tools:mode-'));
    expect([...new Set(modeButtons)]).toEqual(['tools:mode-avatar']);
  });

  // docs/specs/002-project-scope/not-in-livehuddle.md "What leaves": offered from nowhere.
  it('offers no diagram tool, no Collaborate element, no frame, no Reaction Pad and no Session button', () => {
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
      'tools:frame',
      'tools:reaction-confetti',
      'tools:mode-laser',
      'tools:mode-spotlight',
      'tools:mode-isometric',
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
      'collab-react',
      'collab-navigate',
      'frame',
    ])
      expect(paletteCategoryOffered(gone), gone).toBe(false);
    expect(SEARCH_ONLY_TILE_IDS).toEqual([]);
  });

  it('offers no Participate category: a Participant has no palette (share-roles.md "A Participant walks")', () => {
    expect(paletteCategoryOffered('participate')).toBe(false);
    expect(PALETTE_CATEGORIES.some((c) => c.id === 'participate')).toBe(false);
  });
});
