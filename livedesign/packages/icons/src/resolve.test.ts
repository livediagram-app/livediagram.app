import { describe, expect, it } from 'vitest';
import { ICON_CATALOG_1 } from './icon-catalog-1';
import { iconPrimMarkup } from './markup';
import {
  emojiArtOf,
  iconEmojiGlyph,
  previewResolvers,
  resolveIconExportArt,
  resolveIconPreviewArt,
  resolveStickerArt,
  resolveStickerPreviewArt,
  stickerEmojiGlyph,
  twemojiFileName,
} from './resolve';
import { STICKER_CATALOG } from './sticker-catalog';
import { TECH_ICON_CATALOG } from './tech-icon-catalog';

describe('resolveIconExportArt', () => {
  it('resolves a Technology icon to self-coloured tile art', () => {
    const s3 = TECH_ICON_CATALOG.find((i) => i.id === 'aws-s3')!;
    const art = resolveIconExportArt('aws-s3');
    expect(art).toBeDefined();
    expect(art!.colored).toBe(true);
    // The brand tile carries the catalogue colour, and the glyph rides in
    // the white line-art group.
    expect(art!.markup).toContain(`fill="${s3.color}"`);
    expect(art!.markup).toContain('stroke="#fff"');
    expect(art!.markup).toContain(s3.glyph);
  });

  it('resolves a line-art icon to colourless prims markup', () => {
    const art = resolveIconExportArt('server');
    expect(art).toBeDefined();
    expect(art!.colored).toBe(false);
    // Colourless: the caller wraps with the element's stroke colour.
    expect(art!.markup).not.toContain('stroke=');
    expect(art!.markup).not.toContain('fill=');
  });

  it('returns undefined for an unknown id', () => {
    expect(resolveIconExportArt('nope-not-an-icon')).toBeUndefined();
  });

  it('every catalogue entry resolves', () => {
    for (const icon of TECH_ICON_CATALOG) {
      expect(resolveIconExportArt(icon.id), icon.id).toBeDefined();
    }
    for (const icon of ICON_CATALOG_1) {
      expect(resolveIconExportArt(icon.id), icon.id).toBeDefined();
    }
  });
});

describe('iconPrimMarkup', () => {
  it('renders each primitive kind', () => {
    expect(iconPrimMarkup({ t: 'path', d: 'M1 2' })).toBe('<path d="M1 2"/>');
    expect(iconPrimMarkup({ t: 'circle', cx: 1, cy: 2, r: 3 })).toBe(
      '<circle cx="1" cy="2" r="3"/>',
    );
    expect(iconPrimMarkup({ t: 'rect', x: 1, y: 2, w: 3, h: 4, rx: 0.5 })).toBe(
      '<rect x="1" y="2" width="3" height="4" rx="0.5"/>',
    );
    expect(iconPrimMarkup({ t: 'rect', x: 1, y: 2, w: 3, h: 4 })).toBe(
      '<rect x="1" y="2" width="3" height="4"/>',
    );
    expect(iconPrimMarkup({ t: 'line', x1: 1, y1: 2, x2: 3, y2: 4 })).toBe(
      '<line x1="1" y1="2" x2="3" y2="4"/>',
    );
    expect(iconPrimMarkup({ t: 'polyline', points: '1,2 3,4' })).toBe(
      '<polyline points="1,2 3,4"/>',
    );
    expect(iconPrimMarkup({ t: 'polygon', points: '1,2 3,4' })).toBe('<polygon points="1,2 3,4"/>');
    expect(iconPrimMarkup({ t: 'ellipse', cx: 1, cy: 2, rx: 3, ry: 4 })).toBe(
      '<ellipse cx="1" cy="2" rx="3" ry="4"/>',
    );
    // The text prim (docs/specs/010-palette/emoji-icons.md emoji entries): centred anchor + central
    // baseline so the glyph sits on (x, y); an explicit fill so the
    // line-art wrapper's fill="none" can't blank it, stroke="none" so it
    // can't render hollow.
    const text = iconPrimMarkup({ t: 'text', text: '👍', x: 12, y: 12, size: 20 });
    expect(text).toBe(
      '<text x="12" y="12" font-size="20"' +
        ' font-family="system-ui, &#39;Apple Color Emoji&#39;, &#39;Segoe UI Emoji&#39;, &#39;Noto Color Emoji&#39;, sans-serif"' +
        ' text-anchor="middle" dominant-baseline="central" fill="currentColor"' +
        ' stroke="none">👍</text>',
    );
  });

  it('escapes XML specials in the text prim payload', () => {
    const markup = iconPrimMarkup({ t: 'text', text: '<&>', x: 12, y: 12, size: 20 });
    expect(markup).toContain('>&lt;&amp;&gt;</text>');
    expect(markup).not.toContain('<&');
  });
});

// docs/specs/015-api/mcp-server.md §5: a preview with no emoji font draws an emoji as a labelled disc.
describe('the preview resolvers', () => {
  it('draw an emoji icon or sticker as its placeholder, and every other as ever', () => {
    expect(resolveIconPreviewArt('emoji-fire')).toMatchObject({
      colored: true,
      markup: expect.stringContaining('>emoji<'),
    });
    expect(resolveIconPreviewArt('clock')).toEqual(resolveIconExportArt('clock'));
    expect(resolveIconPreviewArt('nope')).toBeUndefined();
    expect(resolveStickerPreviewArt('emoji-thumbs-up')?.markup).toContain('>emoji<');
    const badge = STICKER_CATALOG.find((s) => s.kind !== 'emoji')!;
    expect(resolveStickerPreviewArt(badge.id)).toEqual(resolveStickerArt(badge.id));
  });

  it('draw an emoji from its art when it was fetched, by its glyph', () => {
    const art = { viewBox: '0 0 36 36', markup: '<path d="M0 0h36v36z"/>' };
    const {
      resolveIconArt,
      resolveStickerArt: sticker,
      resolveEmojiArt,
    } = previewResolvers(new Map([['👍', art]]));
    expect(sticker('emoji-thumbs-up')?.markup).toContain(
      '<svg x="23" y="23" width="54" height="54" viewBox="0 0 36 36" data-finish-keep=""><path d="M0 0h36v36z"/></svg>',
    );
    expect(resolveIconArt('emoji-thumbs-up')).toEqual({
      colored: true,
      markup:
        '<svg x="2" y="2" width="20" height="20" viewBox="0 0 36 36" data-finish-keep=""><path d="M0 0h36v36z"/></svg>',
    });
    // An emoji not fetched stays the disc; anything else draws as ever.
    expect(sticker('emoji-fire')?.markup).toContain('>emoji<');
    expect(resolveIconArt('clock')).toEqual(resolveIconExportArt('clock'));
    expect(resolveEmojiArt('👍')).toBe(art);
    expect(resolveEmojiArt('🔥')).toBeUndefined();
  });
});

describe('emoji art', () => {
  it('names an emoji as Twemoji does, keeping the variation selector only in a joined sequence', () => {
    expect(twemojiFileName('🚀')).toBe('1f680');
    expect(twemojiFileName('❤️')).toBe('2764');
    expect(twemojiFileName('👩‍💻')).toBe('1f469-200d-1f4bb');
    expect(twemojiFileName('🏳️‍🌈')).toBe('1f3f3-fe0f-200d-1f308');
  });

  it("reads an emoji SVG's viewBox and contents, and nothing else", () => {
    expect(
      emojiArtOf('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path/></svg>'),
    ).toEqual({ viewBox: '0 0 36 36', markup: '<path/>' });
    expect(emojiArtOf('<svg><path/></svg>')).toBeNull();
    expect(emojiArtOf('Not Found')).toBeNull();
  });

  it('knows the emoji a sticker or icon draws', () => {
    expect(stickerEmojiGlyph('emoji-thumbs-up')).toBe('👍');
    expect(iconEmojiGlyph('emoji-thumbs-up')).toBe('👍');
    expect(stickerEmojiGlyph(STICKER_CATALOG.find((s) => s.kind !== 'emoji')!.id)).toBeUndefined();
    expect(iconEmojiGlyph('clock')).toBeUndefined();
  });
});
