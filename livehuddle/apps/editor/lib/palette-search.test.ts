import { describe, expect, it } from 'vitest';

import { SHAPE_KINDS } from '@livehuddle/document';

import { modeElementTiles } from '@/components/palette/palette-tile-search';
import { buildPaletteSearchItems } from '@/lib/palette-search';
import { SHAPE_KEYWORDS } from '@/lib/palette-tile-keywords';

// Drift guard. The "Add to canvas" catalogue used to be a hand-written list of
// shapes, and it had fallen 22 kinds behind the palette without anything
// failing: every Devices, Data, Media and Behaviour element was unfindable
// from the search panel. It now derives from the meeting palette's tiles, and these tests
// exist so that stays true. It offers only what that palette offers
// (docs/specs/002-project-scope/not-in-livehuddle.md "The diagram tools still in livehuddle's UI").

const OFFERED = modeElementTiles('workshop');
const shapeTiles = OFFERED.filter(
  (t) => t.action.type === 'shape' && t.action.kind !== 'icon' && t.action.kind !== 'sticker',
);

describe('buildPaletteSearchItems', () => {
  it('offers every shape-placing palette tile', () => {
    const ids = new Set(buildPaletteSearchItems().map((i) => i.id));
    const missing = shapeTiles
      .map((t) => {
        // Tiles that differ only by their creation-time choice (the mode
        // buttons) each get their own id, or the
        // panel would show one of them and silently drop the rest.
        const a = t.action as {
          kind: string;
          mode?: string;
          plan?: string;
        };
        const choice = a.mode ?? a.plan;
        return choice ? `shape:${a.kind}:${choice}` : `shape:${a.kind}`;
      })
      .filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });

  it('offers every non-shape palette tile too (text, sticky, frame, ...)', () => {
    const ids = new Set(buildPaletteSearchItems().map((i) => i.id));
    const missing = OFFERED.filter(
      (t) => !['shape', 'icon', 'tech-icon', 'sticker'].includes(t.action.type),
    )
      .map((t) => `tile:${t.id}`)
      .filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
    for (const id of ['tile:tools:text', 'tile:tools:sticky']) expect(ids).toContain(id);
  });

  it('offers no diagram tool the meeting palette left out', () => {
    const ids = new Set(buildPaletteSearchItems().map((i) => i.id));
    for (const id of [
      'shape:square',
      'shape:lane',
      'shape:stack',
      'shape:bar-chart',
      'tile:tools:arrow',
      'tile:tools:table',
      'tile:tools:pencil',
    ])
      expect(ids).not.toContain(id);
  });

  it('hides the image-upload tiles when the editor has no image support', () => {
    const ids = new Set(buildPaletteSearchItems({ hasImage: false }).map((i) => i.id));
    const imageTiles = OFFERED.filter((t) => t.needsImage && t.action.type !== 'shape');
    expect(imageTiles.length).toBeGreaterThan(0);
    for (const t of imageTiles) expect(ids).not.toContain(`tile:${t.id}`);
  });

  it('covers the element types the palette added most recently', () => {
    // Named explicitly rather than left to the derivation above, so a
    // regression that dropped these from the PALETTE_TILES filter still fails
    // rather than agreeing with itself.
    const ids = new Set(buildPaletteSearchItems().map((i) => i.id));
    for (const kind of ['portal', 'chair', 'room']) {
      expect(ids.has(`shape:${kind}`)).toBe(true);
    }
    // The Page left livehuddle (docs/specs/002-project-scope/not-in-livehuddle.md, Work Tracker #423 part 2): no
    // search result places one, though a stored Page still draws.
    expect([...ids].filter((id) => id === 'shape:page' || id === 'tile:tools:page')).toEqual([]);
    // The one Selection Mode button left, the Avatar one (docs/specs/009-elements/mode-button.md "Only Avatar").
    expect([...ids].filter((id) => id.startsWith('shape:mode-button'))).toEqual([
      'shape:mode-button:avatar',
    ]);
  });

  it('names each entry from the tile, not from its id', () => {
    const portal = buildPaletteSearchItems().find((i) => i.id === 'shape:portal');
    expect(portal?.name).toBe('Portal');
    // The tile's keywords and description feed the search, so the words the palette
    // already writes about an element are searchable without being restated.
    expect(portal?.keywords).toContain('teleport');
  });

  it('emits no duplicate ids', () => {
    const ids = buildPaletteSearchItems().map((i) => i.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('keys its synonym map on real shape kinds only', () => {
    for (const item of buildPaletteSearchItems()) {
      if (!item.id.startsWith('shape:')) continue;
      expect(SHAPE_KINDS.has(item.id.split(':')[1]!)).toBe(true);
    }
  });
  it('gives every searchable shape tile its own synonyms', () => {
    // The help registry makes keywords mandatory for an article (AGENTS.md)
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
      // Strip any creation-time choice suffix back to the kind, which is what
      // the synonym map is keyed on.
      .map((i) => i.id.split(':')[1]!)
      .filter((kind) => !(SHAPE_KEYWORDS as Record<string, string | undefined>)[kind]?.trim());
    expect(missing).toEqual([]);
  });

  // Before the icon chunk lands the catalogues hold nothing; a caller passes the subscription's value so the
  // React Compiler rebuilds the list when it does (useIconCatalogs.guard.test.ts).
  it('lists no catalogue entries until the catalogues have loaded, and every tile either way', () => {
    const before = buildPaletteSearchItems({ catalogues: false });
    expect(before.some((i) => /^(icon|sticker|tech):/.test(i.id))).toBe(false);
    const after = buildPaletteSearchItems();
    expect(after.filter((i) => /^(shape|tile):/.test(i.id))).toEqual(before);
  });
});
