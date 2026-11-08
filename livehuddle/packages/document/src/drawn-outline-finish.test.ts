import { describe, expect, it } from 'vitest';
import { MARKER_LINE_PX } from './finish';
import { handDrawnImagePaint, imageCornerPx, outlineStrokePx } from './drawn-outline-finish';
import type { ImageElement } from './index';

// docs/specs/008-canvas/finish.md "Images".
const image = (over: Partial<ImageElement> = {}): ImageElement =>
  ({ id: 'img', type: 'image', x: 0, y: 0, width: 120, height: 80, ...over }) as ImageElement;

describe('outlineStrokePx', () => {
  it('draws an unset line Thin under Professional and at the nib under Marker', () => {
    expect(outlineStrokePx({}, 'professional')).toBe(1);
    expect(outlineStrokePx({}, 'marker')).toBe(MARKER_LINE_PX);
    expect(outlineStrokePx({ strokeWidth: 'thin' }, 'marker')).toBe(MARKER_LINE_PX);
    expect(outlineStrokePx({ strokeWidth: 'thick' }, 'marker')).toBeGreaterThan(MARKER_LINE_PX);
  });
});

describe('an image drawn by hand', () => {
  it('goes round the photo in pencil under Sketch and in marker under Marker', () => {
    const sketch = handDrawnImagePaint(image(), 'sketch');
    expect(sketch?.drawing.pen).toBe('pencil');
    const marker = handDrawnImagePaint(image({ borderRadius: 'full' }), 'marker');
    expect(marker?.drawing.pen).toBe('marker');
  });

  it('leaves the image as it is in another finish, or when it has no room for a line', () => {
    expect(handDrawnImagePaint(image(), 'flexible')).toBeNull();
    expect(handDrawnImagePaint(image({ width: 1, height: 1 }), 'sketch')).toBeNull();
  });

  it('keeps its own corner, square under Professional', () => {
    expect(imageCornerPx(image(), 'professional')).toBeLessThanOrEqual(
      imageCornerPx(image(), 'flexible'),
    );
  });
});
