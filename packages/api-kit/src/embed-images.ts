// Inline uploaded images as base64 data URLs, so a server-side render shows the real picture instead of a
// placeholder box. Every product's api renders tabs for the Explorer thumbnail and live share image (its
// docs/specs/006-*/…-snapshots.md), and its mcp for the PNG it hands the model (docs/specs/015-api/mcp-server.md §5).
// Neither renderer can fetch (resvg is WASM; a cached SVG must be self-contained), so each prefetches the bytes and
// passes a `resolveImageHref` that reads this map. Each product's api-schema binds `embedTabImages` over it with the
// ids its tab references (`tabImageIds`), which is all that reads its element union.
//
// The caller states its policy at the call site:
//
//   - `load` reads one image's bytes + stored type (R2 for the api, the owner-authed GET /api/images/:id for the
//     mcp), or null when missing.
//   - `maxBytesPerImage` skips any single image over the cap.
//   - `totalBudgetBytes` caps the sum, spent in document order: an image that no longer fits is skipped and a later,
//     smaller one may still fit.
//   - `totalBudgetPixels` caps the sum of the pictures' sizes in pixels, read from each header
//     (@liveworkspace/api-schema/image-size), the same way: a rasteriser decodes every picture at full size, so its
//     memory follows the pixels. An image whose size cannot be read is left out under this budget.
//   - `onOverLimit` hears each image left out for a limit (too large alone, or past a budget), in document order,
//     so a caller can say so beside the picture.
//
// Reads run EMBED_IMAGE_CONCURRENCY at a time, started in document order, and each is judged in document order once
// every one before it has been, so the map, its order and the `onOverLimit` calls are what reading one at a time
// gave. A read that is already over the remaining budget when it lands drops its bytes at once (the budget only
// shrinks), so at most EMBED_IMAGE_CONCURRENCY images that could still fit are held at a time.
//
// Any image that is missing, over a limit, fails to load, or isn't one of the accepted raster formats is left out,
// and the renderer draws its placeholder.

import { imagePixelSize } from '@liveworkspace/api-schema/image-size';
import { sniffImageType } from '@liveworkspace/api-schema/image-sniff';
import { bytesToBase64 } from './bytes';

export type EmbedImageSource = (
  imageId: string,
) => Promise<{ bytes: ArrayBuffer; contentType: string | null } | null>;

export type EmbedImageLimits = {
  maxBytesPerImage?: number;
  totalBudgetBytes?: number;
  totalBudgetPixels?: number;
  onOverLimit?: (imageId: string) => void;
};

// A Worker opens at most six connections at once; more reads would only queue behind them.
export const EMBED_IMAGE_CONCURRENCY = 6;

// The data URL's type. An `<image href="data:...">` only renders with an image/* type the renderer can decode, so a
// stored type that is missing or generic (`application/octet-stream`, what an R2 object without metadata is served
// as) is replaced by the type the bytes themselves sniff as. Uploads are sniffed and stored with their real type
// (docs/specs/009-elements/images.md), so this only matters for an object whose metadata was lost; bytes that match
// no accepted format get no data URL at all.
function dataUrlType(bytes: Uint8Array, declared: string | null): string | null {
  if (declared?.startsWith('image/')) return declared;
  return sniffImageType(bytes);
}

// One read as it lands: nothing to embed, too large however much budget is left, or the bytes.
type Landed = 'skip' | 'over' | { bytes: ArrayBuffer; contentType: string | null };

/** The images `ids` name (each once, in document order), as data URLs within the limits. */
export async function embedImages(
  ids: readonly string[],
  load: EmbedImageSource,
  limits: EmbedImageLimits = {},
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { maxBytesPerImage = Infinity, totalBudgetBytes, totalBudgetPixels, onOverLimit } = limits;
  let budget = totalBudgetBytes ?? Infinity;
  let pixelBudget = totalBudgetPixels ?? Infinity;

  const read = async (id: string): Promise<Landed> => {
    let loaded: Awaited<ReturnType<EmbedImageSource>>;
    try {
      loaded = await load(id);
    } catch {
      return 'skip';
    }
    if (!loaded) return 'skip';
    const size = loaded.bytes.byteLength;
    // `budget` is what is left now; it can only shrink before this read is judged.
    return size > maxBytesPerImage || size > budget ? 'over' : loaded;
  };

  // Judge one read, in document order. Every skip is silent, because a placeholder is the right outcome for each.
  const judge = (id: string, landed: Landed): void => {
    if (landed === 'skip') return;
    const size = landed === 'over' ? Infinity : landed.bytes.byteLength;
    if (landed === 'over' || size > budget) {
      onOverLimit?.(id);
      return;
    }
    const bytes = new Uint8Array(landed.bytes);
    const type = dataUrlType(bytes, landed.contentType);
    if (!type) return;
    let pixels = 0;
    if (totalBudgetPixels !== undefined) {
      const dims = imagePixelSize(bytes);
      if (!dims) return;
      pixels = dims.width * dims.height;
      if (pixels > pixelBudget) {
        onOverLimit?.(id);
        return;
      }
    }
    budget -= size;
    pixelBudget -= pixels;
    map.set(id, `data:${type};base64,${bytesToBase64(bytes)}`);
  };

  // A window of reads in flight, started in document order; the oldest is judged as soon as it lands.
  const pending: (Promise<Landed> | undefined)[] = [];
  let next = 0;
  const startUpTo = (index: number) => {
    while (next < ids.length && next < index) pending[next] = read(ids[next++]!);
  };
  for (let i = 0; i < ids.length; i++) {
    startUpTo(i + EMBED_IMAGE_CONCURRENCY);
    const landed = await pending[i]!;
    // Released, so a judged read's bytes are not held to the end.
    pending[i] = undefined;
    judge(ids[i]!, landed);
  }
  return map;
}
