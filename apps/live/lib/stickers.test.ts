import { beforeAll, describe, expect, it } from 'vitest';
import {
  STICKER_CATEGORIES,
  getStickerCatalog,
  searchStickers,
  stickersInCategory,
} from './stickers';
import { ensureIconCatalogs } from './icon-registry';

// Stickers live in the shared icon catalogue, which loads as an async chunk
// (lib/icon-registry.ts); load it once up front so these tests see the
// populated state.
beforeAll(async () => {
  await ensureIconCatalogs();
});

describe('sticker catalogue (spec/113)', () => {
  it('is the size the Stickers tab promises', () => {
    // A floor, not an exact count — adding a sticker shouldn't fail a build,
    // but silently losing half the catalogue should.
    expect(getStickerCatalog().length).toBeGreaterThanOrEqual(180);
  });

  it('every sticker is one text prim at the shared geometry', () => {
    for (const sticker of getStickerCatalog()) {
      expect(sticker.prims, sticker.id).toHaveLength(1);
      const prim = sticker.prims[0];
      expect(prim?.t, sticker.id).toBe('text');
      if (prim?.t !== 'text') continue; // unreachable; narrows the prim union
      expect(prim.text.length, sticker.id).toBeGreaterThan(0);
      expect({ x: prim.x, y: prim.y, size: prim.size }, sticker.id).toEqual({
        x: 12,
        y: 12,
        size: 20,
      });
    }
  });

  it('every sticker has a label and search keywords', () => {
    for (const sticker of getStickerCatalog()) {
      expect(sticker.label.length, sticker.id).toBeGreaterThan(0);
      expect(sticker.keywords.trim().length, sticker.id).toBeGreaterThan(0);
    }
  });
});

describe('sticker groups', () => {
  it('every group id resolves to a catalogue entry', () => {
    const known = new Set(getStickerCatalog().map((s) => s.id));
    for (const cat of STICKER_CATEGORIES) {
      for (const id of cat.stickerIds) {
        expect(known.has(id), `group "${cat.id}" references unknown sticker "${id}"`).toBe(true);
      }
    }
  });

  it('puts every sticker in exactly one group', () => {
    // The tab browses BY group with no "All" view, so a sticker in no group is
    // one nobody can reach except by guessing its name in the search box; a
    // sticker in two shows up twice in a browse that is meant to be a tour of
    // the catalogue (spec/113).
    const seen = new Map<string, string[]>();
    for (const cat of STICKER_CATEGORIES) {
      for (const id of cat.stickerIds) seen.set(id, [...(seen.get(id) ?? []), cat.id]);
    }
    const orphans = getStickerCatalog()
      .map((s) => s.id)
      .filter((id) => !seen.has(id));
    expect(
      orphans,
      'stickers in no STICKER_CATEGORIES group are unreachable in the palette',
    ).toEqual([]);
    const duplicated = [...seen].filter(([, cats]) => cats.length > 1);
    expect(duplicated).toEqual([]);
  });

  it('stickersInCategory returns catalogue entries in catalogue order', () => {
    const catalog = getStickerCatalog();
    const reactions = stickersInCategory('reactions');
    expect(reactions.length).toBeGreaterThan(0);
    expect(reactions.every((s) => catalog.includes(s))).toBe(true);
    expect(stickersInCategory('does-not-exist')).toEqual([]);
  });
});

describe('searchStickers', () => {
  it('matches on label, keyword and id, and never leaves the sticker half', () => {
    expect(searchStickers('thumbs').map((s) => s.id)).toContain('emoji-thumbs-up');
    // Keyword-only hit: nothing in the label says "celebrate".
    expect(searchStickers('celebrate').map((s) => s.id)).toContain('emoji-party-popper');
    expect(searchStickers('emoji-rocket').map((s) => s.id)).toEqual(['emoji-rocket']);
    // 'server' is a line-art icon; the Stickers tab must not surface it.
    expect(searchStickers('server')).toEqual([]);
  });

  it('returns the whole catalogue for an empty query', () => {
    expect(searchStickers('  ')).toEqual(getStickerCatalog());
  });
});
