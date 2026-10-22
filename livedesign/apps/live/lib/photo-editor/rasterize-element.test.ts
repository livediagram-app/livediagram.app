import { describe, expect, it } from 'vitest';
import type { Element } from '@livedesign/document';
import { elementPhotoRect, RASTERIZE_MARGIN } from './rasterize-element';

const box = (x: number, y: number, width: number, height: number) =>
  ({ id: 's', type: 'shape', shape: 'square', x, y, width, height }) as unknown as Element;

describe('elementPhotoRect', () => {
  const page = { rect: { x: 100, y: 0, width: 500, height: 250 } };
  const photo = { width: 2000, height: 1000 };

  it('maps the element’s box (with room for its stroke) into the photo’s px', () => {
    const el = box(200, 50, 100, 50);
    const r = elementPhotoRect(el, [el], page, photo)!;
    expect(r.x).toBe((100 - RASTERIZE_MARGIN) * 4);
    expect(r.width).toBe((100 + RASTERIZE_MARGIN * 2) * 4);
  });

  it('clamps to the photo, and answers nothing off it', () => {
    const edge = box(90, -20, 40, 40);
    expect(elementPhotoRect(edge, [edge], page, photo)).toMatchObject({ x: 0, y: 0 });
    const off = box(5000, 5000, 10, 10);
    expect(elementPhotoRect(off, [off], page, photo)).toBeNull();
  });
});
