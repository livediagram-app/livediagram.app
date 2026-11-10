import { describe, expect, it } from 'vitest';
import { canvasFilters, greyPixels } from './image-greyscale';

// docs/specs/009-elements/picture-crop-and-mask.md "Export and preview".
describe('image greyscale', () => {
  it('turns pixels to their Rec. 709 luminance, alpha kept', () => {
    const d = new Uint8ClampedArray([255, 0, 0, 128, 0, 255, 0, 255, 10, 10, 10, 0]);
    greyPixels(d);
    expect(Array.from(d)).toEqual([54, 54, 54, 128, 182, 182, 182, 255, 10, 10, 10, 0]);
  });

  it('reads whether a context applies filters', () => {
    const ok = { filter: 'none' } as unknown as CanvasRenderingContext2D;
    expect(canvasFilters(ok)).toBe(true);
    expect(ok.filter).toBe('none');
    const stuck = {
      get filter() {
        return 'none';
      },
      set filter(_v: string) {},
    } as unknown as CanvasRenderingContext2D;
    expect(canvasFilters(stuck)).toBe(false);
    expect(canvasFilters({} as CanvasRenderingContext2D)).toBe(false);
  });
});
