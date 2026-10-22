import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CARD_TILE_GLYPH_PX } from './palette-plan-tiles';
import { PALETTE_TILES, TILE_GLYPH_PX, tileById, tilesForCategory } from './palette-tile-defs';

// The shared tile catalogue feeds the editor's search panel and a dashboard slot's picker, both of which address
// tiles by id. These invariants pin the contracts they rely on.

describe('PALETTE_TILES catalogue', () => {
  it('has unique ids (search and the slot picker address tiles by id)', () => {
    const ids = PALETTE_TILES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Plan places boards, sheets, views and cards, and beside them a few other elements: nothing that organises a
  // diagram (docs/specs/026-plan/plan-mode.md "The palette").
  it('holds only what Plan places', () => {
    const others = PALETTE_TILES.filter((t) => t.section === 'tools').map((t) => t.id);
    expect(others.sort()).toEqual(
      [
        'collab:temperature',
        'tools:page',
        'tools:picker',
        'tools:session-stopwatch',
        'tools:session-timer',
        'tools:sticky',
        'tools:text',
      ].sort(),
    );
  });

  // A dashboard slot offers each of these as a group (SlotFillPicker), so an empty one would be a heading over
  // nothing.
  it.each(['plan-boards', 'plan-sheets', 'plan-metrics', 'plan-visualisations'] as const)(
    'gives %s tiles of its own',
    (section) => {
      expect(tilesForCategory(section).length).toBeGreaterThan(0);
    },
  );

  it('finds a tile by its id', () => {
    expect(tileById('tools:sticky')?.action).toEqual({ type: 'sticky' });
    expect(tileById('shapes:square')).toBeUndefined();
  });
});

// One tile strip, one size step (docs/specs/004-interface-design/iconography.md): every tile glyph
// that renders through Glyph does so at TILE_GLYPH_PX, so a strip of tiles reads as one set.
describe('palette tile glyph size', () => {
  const glyphTiles = PALETTE_TILES.map(
    (t) => [t.id, renderToStaticMarkup(<>{t.icon}</>)] as const,
  ).filter(([, svg]) => svg.includes('lvd-glyph'));

  // Plan card tiles are the one larger step: a card picture with its type's glyph on the face.
  it.each(glyphTiles)('%s renders at the tile step', (id, svg) => {
    expect(Number(/width="([\d.]+)"/.exec(svg)![1])).toBe(
      id.startsWith('plan:card-') ? CARD_TILE_GLYPH_PX : TILE_GLYPH_PX,
    );
  });
});

// docs/specs/012-collaboration/session-button.md: the Timer and Stopwatch tiles sit side by side and must not
// wear the same glyph.
describe('session clock tiles', () => {
  it('draw the timer and the stopwatch differently', () => {
    const glyph = (id: string) =>
      renderToStaticMarkup(<>{PALETTE_TILES.find((t) => t.id === id)!.icon}</>);
    expect(glyph('tools:session-timer')).not.toBe(glyph('tools:session-stopwatch'));
  });
});
