import { describe, expect, it } from 'vitest';
import type { PageImageFill } from '@livedesign/document';
import { backgroundCategoryOf, fillCss, pageSheetStyle } from './page-paint';
import {
  pageImageCssUrl,
  pageImageOverlayCss,
  pageImagePositionCss,
  pageImageSrc,
} from './page-image-paint';

// docs/specs/007-editor/pages-mode.md "Image backgrounds": the overlay, the crop, and the
// same paint on the sheet and in the exports.
const fill = (over: Partial<PageImageFill> = {}): PageImageFill => ({
  kind: 'image',
  imageId: 'img-1',
  tone: '#203040',
  overlay: { kind: 'light', strength: 0.6 },
  ...over,
});
const blob = (id: string) => (id === 'img-1' ? 'blob:http://localhost/abc' : undefined);

describe('a picture on the sheet', () => {
  it('layers the pattern, the overlay and the cropped picture over its tone', () => {
    const style = pageSheetStyle(
      { fill: fill({ position: 'top' }), pattern: 'dots' },
      undefined,
      blob,
    );
    const layers = String(style.backgroundImage);
    expect(layers.indexOf('radial-gradient')).toBeLessThan(
      layers.indexOf('rgb(255 255 255 / 0.6)'),
    );
    expect(layers.indexOf('rgb(255 255 255 / 0.6)')).toBeLessThan(
      layers.indexOf('url("blob:http://localhost/abc")'),
    );
    expect(style.backgroundSize).toBe('24px 24px, 100% 100%, cover');
    expect(style.backgroundRepeat).toBe('repeat, repeat, no-repeat');
    expect(style.backgroundPosition).toBe('0 0, 0 0, center top');
    expect(style.backgroundColor).toBe('#203040');
  });

  it('paints its tone alone until its bytes arrive', () => {
    const style = pageSheetStyle({ fill: fill({ overlay: undefined }) });
    expect(style.backgroundImage).toBeUndefined();
    expect(style.backgroundColor).toBe('#203040');
  });

  it('previews a hovered result from its thumbnail, and an offline picture from its bytes', () => {
    expect(pageImageSrc(fill({ preview: 'https://api.openverse.org/t/' }), blob)).toBe(
      'https://api.openverse.org/t/',
    );
    expect(pageImageSrc(fill({ imageId: 'data:image/png;base64,AA==' }))).toBe(
      'data:image/png;base64,AA==',
    );
    expect(pageImageSrc(fill(), blob)).toBe('blob:http://localhost/abc');
    expect(pageImageSrc(fill({ imageId: 'other' }), blob)).toBeUndefined();
  });

  it('never puts an unsafe source in a CSS url()', () => {
    expect(pageImageCssUrl('blob:http://localhost/abc')).toBe('url("blob:http://localhost/abc")');
    expect(pageImageCssUrl('https://x.org/a.jpg")')).toBeNull();
    expect(pageImageCssUrl('javascript:alert(1)')).toBeNull();
    expect(pageImageCssUrl('http://x.org/a.jpg')).toBeNull();
    expect(pageImageCssUrl('data:image/svg+xml;base64,AA')).toBeNull();
  });

  it('washes flat, fades clear at the top, and crops by position', () => {
    expect(pageImageOverlayCss({ kind: 'dark', strength: 0.5 })).toBe(
      'linear-gradient(rgb(15 23 42 / 0.5), rgb(15 23 42 / 0.5))',
    );
    expect(pageImageOverlayCss({ kind: 'fade', strength: 0.8 })).toBe(
      'linear-gradient(180deg, rgb(255 255 255 / 0), rgb(255 255 255 / 0.8))',
    );
    expect(pageImageOverlayCss({ kind: 'tint', strength: 0.3, color: '#ff0000' })).toContain(
      'rgb(255 0 0 / 0.3)',
    );
    expect(pageImagePositionCss(undefined)).toBe('center');
    expect(pageImagePositionCss('bottom')).toBe('center bottom');
  });

  it('is the Image category, its swatch its tone under its overlay', () => {
    expect(backgroundCategoryOf(fill())).toBe('image');
    expect(fillCss(fill({ tone: '#000000', overlay: { kind: 'light', strength: 0.5 } }))).toBe(
      '#808080',
    );
  });
});
