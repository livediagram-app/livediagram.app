import { beforeAll, describe, expect, it } from 'vitest';
import { stickerArt } from '@livediagram/icons';
import {
  STICKER_CATEGORIES,
  getSticker,
  getStickerCatalog,
  searchStickers,
  stickerDropSize,
  stickerTilt,
  stickersInCategory,
} from './stickers';
import { ensureIconCatalogs } from './icon-registry';

// The sticker catalogue rides the async icon chunk (lib/icon-registry.ts);
// load it once up front so these tests see the populated state.
beforeAll(async () => {
  await ensureIconCatalogs();
});

describe('sticker catalogue (spec/116)', () => {
  it('is the size the Stickers tab promises, in both flavours', () => {
    // Floors, not exact counts — adding a sticker shouldn't fail a build, but
    // silently losing half the catalogue should.
    const all = getStickerCatalog();
    expect(all.length).toBeGreaterThanOrEqual(180);
    expect(all.filter((s) => s.kind === 'emoji').length).toBeGreaterThanOrEqual(150);
    expect(all.filter((s) => s.kind === 'badge').length).toBeGreaterThanOrEqual(24);
  });

  it('every sticker has a label, keywords, and the art its flavour needs', () => {
    for (const s of getStickerCatalog()) {
      expect(s.label.length, s.id).toBeGreaterThan(0);
      expect(s.keywords.trim().length, s.id).toBeGreaterThan(0);
      if (s.kind === 'emoji') expect(s.glyph.length, s.id).toBeGreaterThan(0);
      else expect(s.text.trim().length, s.id).toBeGreaterThan(0);
    }
  });

  it('every sticker builds art that draws the plate and its content', () => {
    for (const s of getStickerCatalog()) {
      const art = stickerArt(s);
      expect(art.viewBox, s.id).toMatch(/^0 0 \d+ \d+$/);
      // The die-cut plate is what makes it a sticker rather than a glyph, so
      // pin that it is always drawn, along with the sticker's own content.
      expect(art.markup, s.id).toContain('fill="#ffffff"');
      expect(art.markup, s.id).toContain(s.kind === 'emoji' ? s.glyph : s.text);
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
    // sticker in two shows up twice in a browse meant to be a tour of the
    // catalogue (spec/116).
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
  it('matches on label, keyword, id, and a badge word', () => {
    expect(searchStickers('thumbs').map((s) => s.id)).toContain('emoji-thumbs-up');
    // Keyword-only hit: nothing in the label says "celebrate".
    expect(searchStickers('celebrate').map((s) => s.id)).toContain('emoji-party-popper');
    expect(searchStickers('emoji-rocket').map((s) => s.id)).toEqual(['emoji-rocket']);
    // The word on the pill is searchable in its own right.
    expect(searchStickers('approved').map((s) => s.id)).toContain('badge-approved');
    // 'server' is a line-art icon; the Stickers tab must not surface it.
    expect(searchStickers('server')).toEqual([]);
  });

  it('returns the whole catalogue for an empty query', () => {
    expect(searchStickers('  ')).toEqual(getStickerCatalog());
  });
});

describe('drop geometry', () => {
  it('sizes an emoji square and a badge to the pill aspect', () => {
    const base = { width: 104, height: 104 };
    expect(stickerDropSize(getSticker('emoji-fire'), base)).toEqual({ width: 104, height: 104 });
    expect(stickerDropSize(getSticker('badge-blocked'), base)).toEqual({ width: 260, height: 104 });
    // Unknown / not-yet-loaded id falls back to the square, never to NaN.
    expect(stickerDropSize(undefined, base)).toEqual({ width: 104, height: 104 });
  });

  it('tilts deterministically, so every client and the export agree', () => {
    expect(stickerTilt('abc123')).toBe(stickerTilt('abc123'));
    expect(stickerTilt('abc123')).not.toBe(0);
    // Different elements do not all land at the same angle.
    const angles = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(stickerTilt));
    expect(angles.size).toBeGreaterThan(1);
  });
});
