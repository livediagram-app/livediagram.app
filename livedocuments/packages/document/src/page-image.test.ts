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

describe('blur (pages-mode.md "Image backgrounds", Blur)', () => {
  it('is kept in 5% steps, clamped, and dropped for none', async () => {
    const { parsePageImageBlur, pageImageBlurSigma, parsePageImageFill, samePageImage } =
      await import('./page-image');
    expect(parsePageImageBlur(0.42)).toBe(0.4);
    expect(parsePageImageBlur(3)).toBe(1);
    expect(parsePageImageBlur(0)).toBeUndefined();
    expect(parsePageImageBlur('0.5')).toBeUndefined();
    expect(parsePageImageFill({ kind: 'image', imageId: ID, blur: 0.5 })?.blur).toBe(0.5);
    expect(parsePageImageFill({ kind: 'image', imageId: ID, blur: -1 })).not.toHaveProperty('blur');
    expect(pageImageBlurSigma({ blur: 1 }, { width: 1920, height: 1080 })).toBeCloseTo(43.2);
    expect(pageImageBlurSigma({}, { width: 1920, height: 1080 })).toBe(0);
    const a = { kind: 'image' as const, imageId: ID };
    expect(samePageImage(a, { ...a, blur: 0.5 })).toBe(false);
    expect(samePageImage(a, { ...a })).toBe(true);
  });

  it('draws the export picture under a Gaussian blur with solid edges', async () => {
    const { pageImageSvg } = await import('./page-frame');
    const fill = { kind: 'image' as const, imageId: ID, blur: 0.5 };
    const svg = pageImageSvg(fill, { x: 0, y: 0, width: 1000, height: 500 }, 'data:x', 'p');
    expect(svg).toContain('<feGaussianBlur stdDeviation="10"/>');
    expect(svg).toContain('tableValues="1 1"');
    expect(svg).toContain('<g filter="url(#p-blur)"><image');
    expect(
      pageImageSvg(
        { ...fill, blur: undefined },
        { x: 0, y: 0, width: 10, height: 10 },
        'data:x',
        'p',
      ),
    ).not.toContain('feGaussianBlur');
  });
});
