import { describe, expect, it } from 'vitest';
import { pagesOf } from './page';
import { pageIsDark, pageSurface } from './page-content';
import { sameFill } from './page-paint';
import {
  defaultPageImageOverlay,
  isPageImageId,
  mixHex,
  pageImageIds,
  pageImageTone,
  withPageImageIds,
  type PageImageFill,
} from './page-image';

// docs/specs/007-editor/pages-mode.md "Image backgrounds".
const ID = '3f2b8c1e-0d4a-4f7e-9b1c-2a6d8e0f1a2b';
const page = (fill: unknown, kind?: string) => ({
  id: 'p',
  orientation: 'portrait',
  ...(kind ? { kind } : {}),
  background: { fill },
});
const read = (fill: unknown, kind?: string) => pagesOf({ pages: [page(fill, kind)] })[0]!;

describe('image fills are read safely', () => {
  it('keeps a gallery id with its tone, overlay, position and credit, and drops a preview', () => {
    const fill = {
      kind: 'image',
      imageId: ID,
      tone: '#336699',
      overlay: { kind: 'light', strength: 0.6 },
      position: 'top',
      credit: { text: 'By someone, CC BY 4.0', sourceUrl: 'https://example.org/p' },
      preview: 'https://example.org/thumb.jpg',
    };
    expect(read(fill).background?.fill).toEqual({
      kind: 'image',
      imageId: ID,
      tone: '#336699',
      overlay: { kind: 'light', strength: 0.6 },
      position: 'top',
      credit: { text: 'By someone, CC BY 4.0', sourceUrl: 'https://example.org/p' },
    });
  });

  it('accepts an offline embedded raster but never a web address or a script', () => {
    expect(isPageImageId('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    for (const bad of [
      'https://example.org/a.png',
      'javascript:alert(1)',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:text/html;base64,PGI+',
      'a"b',
      '',
      'x'.repeat(129),
      42,
    ]) {
      expect(isPageImageId(bad)).toBe(false);
      expect(read({ kind: 'image', imageId: bad }).background).toBeUndefined();
    }
  });

  it('clamps the strength, drops an unknown overlay, a tint without a colour and a bad position', () => {
    expect(
      read({ kind: 'image', imageId: ID, overlay: { kind: 'dark', strength: 4 } }).background?.fill,
    ).toEqual({ kind: 'image', imageId: ID, overlay: { kind: 'dark', strength: 0.9 } });
    expect(
      read({ kind: 'image', imageId: ID, overlay: { kind: 'tint', strength: 0.5 }, position: 'x' })
        .background?.fill,
    ).toEqual({ kind: 'image', imageId: ID });
    expect(
      read({ kind: 'image', imageId: ID, overlay: { kind: 'blur', strength: 0.5 } }).background
        ?.fill,
    ).toEqual({ kind: 'image', imageId: ID });
  });

  it('drops a picture from a logo page', () => {
    expect(read({ kind: 'image', imageId: ID }, 'logo').background).toBeUndefined();
  });
});

describe('a picture page reads as its tone under its overlay', () => {
  const fill = (overlay?: PageImageFill['overlay'], tone = '#000000'): PageImageFill => ({
    kind: 'image',
    imageId: ID,
    tone,
    ...(overlay ? { overlay } : {}),
  });

  it('mixes toward the overlay by its strength, a fade by half', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(pageImageTone(fill())).toBe('#000000');
    expect(pageImageTone(fill({ kind: 'light', strength: 0.6 }))).toBe('#999999');
    expect(pageImageTone(fill({ kind: 'fade', strength: 0.6 }))).toBe('#4d4d4d');
    expect(pageImageTone(fill({ kind: 'tint', strength: 1, color: '#ff0000' }))).toBe('#ff0000');
    expect(pageImageTone({ overlay: undefined })).toBe('#808080');
  });

  it('a dark wash makes a dark page, a light wash a light one', () => {
    const bright = '#f8fafc';
    expect(
      pageIsDark({ background: { fill: fill({ kind: 'dark', strength: 0.6 }, bright) } }),
    ).toBe(true);
    expect(
      pageSurface({ background: { fill: fill({ kind: 'light', strength: 0.6 }, '#555555') } }),
    ).toBe('light');
  });

  it('defaults to a readable wash for the canvas', () => {
    expect(defaultPageImageOverlay(false)).toEqual({ kind: 'light', strength: 0.6 });
    expect(defaultPageImageOverlay(true)).toEqual({ kind: 'dark', strength: 0.6 });
  });

  it('compares by picture, overlay and position', () => {
    const a = fill({ kind: 'light', strength: 0.6 });
    expect(sameFill(a, { ...a })).toBe(true);
    expect(sameFill(a, { ...a, overlay: { kind: 'light', strength: 0.5 } })).toBe(false);
    expect(sameFill(a, { ...a, position: 'top' })).toBe(false);
    expect(sameFill(a, { kind: 'solid', color: '#000000' })).toBe(false);
  });
});

describe('the pictures a tab names', () => {
  it('lists each gallery picture once, skipping other fills and junk', () => {
    const pages = [
      page({ kind: 'image', imageId: 'a' }),
      page({ kind: 'image', imageId: 'a' }),
      page({ kind: 'solid', color: '#fff' }),
      page({ kind: 'image', imageId: 'javascript:x' }),
      null,
      page({ kind: 'image', imageId: 'b' }),
    ];
    expect(pageImageIds(pages)).toEqual(['a', 'b']);
    expect(pageImageIds(undefined)).toEqual([]);
  });

  it('re-homes pictures through a mapping, the same array when nothing moves', () => {
    const pages = [page({ kind: 'image', imageId: 'a', tone: '#000000' })];
    expect(withPageImageIds(pages, new Map([['z', 'y']]))).toBe(pages);
    const next = withPageImageIds(pages, new Map([['a', 'data:image/png;base64,AA==']]));
    expect((next![0]!.background.fill as PageImageFill).imageId).toBe('data:image/png;base64,AA==');
    expect((next![0]!.background.fill as PageImageFill).tone).toBe('#000000');
  });
});
