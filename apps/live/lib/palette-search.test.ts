import { describe, expect, it } from 'vitest';

import { SHAPE_KINDS } from '@livediagram/diagram';

import { PALETTE_TILES } from '@/components/palette/palette-tile-defs';
import { buildPaletteSearchItems, SHAPE_KEYWORDS } from '@/lib/palette-search';

// Drift guard. The "Add to canvas" catalogue used to be a hand-written list of
// shapes, and it had fallen 22 kinds behind the palette without anything
// failing: every Devices, Data, Media and Behaviour element was unfindable
// from the search panel. It now derives from PALETTE_TILES, and these tests
// exist so that stays true.

const shapeTiles = PALETTE_TILES.filter(
  (t) => t.action.type === 'shape' && t.action.kind !== 'icon' && t.action.kind !== 'sticker',
);

describe('buildPaletteSearchItems', () => {
  it('offers every shape-placing palette tile', () => {
    const ids = new Set(buildPaletteSearchItems().map((i) => i.id));
    const missing = shapeTiles
      .map((t) => `shape:${(t.action as { kind: string }).kind}`)
      .filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });

  it('covers the element types the palette added most recently', () => {
    // Named explicitly rather than left to the derivation above, so a
    // regression that dropped these from the PALETTE_TILES filter still fails
    // rather than agreeing with itself.
    const ids = new Set(buildPaletteSearchItems().map((i) => i.id));
    for (const kind of ['lane', 'entity', 'mind-node', 'page', 'phone', 'bar-chart', 'portal']) {
      expect(ids.has(`shape:${kind}`)).toBe(true);
    }
  });

  it('names each entry from the tile, not from its id', () => {
    const lane = buildPaletteSearchItems().find((i) => i.id === 'shape:lane');
    expect(lane?.name).toBe('Lane');
    // The tile's description feeds the keywords, so the sentence the palette
    // already writes about an element is searchable without being restated.
    expect(lane?.keywords).toContain('swimlane');
  });

  it('emits no duplicate ids', () => {
    const ids = buildPaletteSearchItems().map((i) => i.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('keys its synonym map on real shape kinds only', () => {
    for (const item of buildPaletteSearchItems()) {
      if (!item.id.startsWith('shape:')) continue;
      expect(SHAPE_KINDS.has(item.id.slice('shape:'.length))).toBe(true);
    }
  });
  it('gives every searchable shape tile its own synonyms', () => {
    // The help registry makes keywords mandatory for an article (CLAUDE.md)
    // because a reader who does not know the title cannot find it otherwise.
    // The palette search has the same problem and no such rule: SHAPE_KEYWORDS
    // is Partial, so a new element joins the panel matching only its own name
    // and description. `?? ''` then hides the omission — nothing renders
    // wrong, the element is just harder to find than its neighbours.
    //
    // The comment pin, done check and reaction pad had all shipped that way.
    // Someone typing "emoji", "tick" or "annotate" found nothing.
    //
    // Derived from the tiles, not from SHAPE_KINDS: `icon` and `sticker` are
    // real kinds whose catalogues are enumerated separately, so they have no
    // shape tile and correctly have no synonyms.
    const missing = buildPaletteSearchItems()
      .filter((i) => i.id.startsWith('shape:'))
      .map((i) => i.id.slice('shape:'.length))
      .filter((kind) => !(SHAPE_KEYWORDS as Record<string, string | undefined>)[kind]?.trim());
    expect(missing).toEqual([]);
  });
});
