// A whole-photo composite that never holds the page for long (docs/specs/031-photo/blueprints/photo-engine.md
// "Performance and limits"): Merge Down, Merge Visible, Merge Layers and Flatten Image composite on the page
// (the layers' pixels are here), so a large photo is worked in bands, the browser given the page between
// them. The same pixels as one compositePhoto call: each band is its own rect of the same composite.
import {
  compositePhoto,
  createRaster,
  type CompositeOptions,
  type Photo,
  type PixelsLookup,
  type Raster,
  type Rect,
} from '@livedesign/photo-engine';

// A band's rows, and how long the page is held before it is given back, ms.
export const COMPOSITE_BAND_ROWS = 256;
export const COMPOSITE_SLICE_MS = 12;
// Under this many px a composite is done at once.
export const COMPOSITE_AT_ONCE_PX = 1024 * 1024;

const giveBack = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function compositeSliced(
  photo: Pick<Photo, 'width' | 'height' | 'layers'>,
  pixels: PixelsLookup,
  rect: Rect,
  opts: CompositeOptions = {},
): Promise<Raster> {
  if (rect.width * rect.height <= COMPOSITE_AT_ONCE_PX)
    return compositePhoto(photo, pixels, rect, opts);
  const out = createRaster(rect.width, rect.height);
  let since = performance.now();
  for (let y = 0; y < rect.height; y += COMPOSITE_BAND_ROWS) {
    const rows = Math.min(COMPOSITE_BAND_ROWS, rect.height - y);
    const band = compositePhoto(photo, pixels, { ...rect, y: rect.y + y, height: rows }, opts);
    out.data.set(band.data, y * rect.width * 4);
    if (performance.now() - since > COMPOSITE_SLICE_MS) {
      await giveBack();
      since = performance.now();
    }
  }
  return out;
}
