// Inline a tab's uploaded images as base64 data URLs, so a server-side render
// shows the real picture instead of a placeholder box. Both workers render
// tabs: the api for the Explorer thumbnail + live share image (docs/specs/006-document/document-snapshots.md), the
// mcp for the PNG it hands the model (docs/specs/015-api/mcp-server.md §5). Neither renderer can fetch
// (resvg is WASM; a cached SVG must be self-contained), so each prefetches the
// bytes and passes a `resolveImageHref` that reads this map.
//
// The two used to carry their own copies and had drifted: different caps,
// different fallback MIME types, and different concurrency. The shared core
// takes the byte source and the limits as arguments so each worker states its
// own policy at the call site:
//
//   - `load` reads one image's bytes + stored type (R2 for the api, the
//     owner-authed GET /api/images/:id for the mcp), or null when missing.
//   - `maxBytesPerImage` skips any single image over the cap.
//   - `totalBudgetBytes` caps the sum. With a budget, images are read one at
//     a time in document order until it is spent, so the result is
//     deterministic and only one image's bytes are held at a time; without
//     one, they are read concurrently.
//   - `totalBudgetPixels` caps the sum of the pictures' sizes in pixels, read
//     from each header (./image-size.ts), the same way: a rasteriser decodes
//     every picture at full size, so its memory follows the pixels. An image
//     whose size cannot be read is left out under this budget.
//   - `onOverLimit` hears each image left out for a limit (too large alone, or
//     past a budget), so a caller can say so beside the picture.
//
// Any image that is missing, over a limit, fails to load, or isn't one of the
// accepted raster formats is left out, and the renderer draws its placeholder.

import { pageImageIds, type Tab } from '@livedesign/document';
import { bytesToBase64 } from './bytes';
import { imagePixelSize } from './image-size';
import { sniffImageType } from './image-sniff';

export type EmbedImageSource = (
  imageId: string,
) => Promise<{ bytes: ArrayBuffer; contentType: string | null } | null>;

type EmbedImageLimits = {
  maxBytesPerImage?: number;
  totalBudgetBytes?: number;
  totalBudgetPixels?: number;
  onOverLimit?: (imageId: string) => void;
};

// The distinct image ids a tab references, in document order.
export function tabImageIds(tab: Pick<Tab, 'elements'> & Partial<Pick<Tab, 'pages'>>): string[] {
  return [
    ...new Set([
      ...tab.elements.flatMap((el) => (el.type === 'image' && el.imageId ? [el.imageId] : [])),
      // A page's picture background (docs/specs/007-editor/pages-mode.md "Image backgrounds").
      ...pageImageIds(tab.pages),
    ]),
  ];
}

// The data URL's type. An `<image href="data:...">` only renders with an
// image/* type the renderer can decode, so a stored type that is missing or
// generic (`application/octet-stream`, what an R2 object without metadata is
// served as) is replaced by the type the bytes themselves sniff as. Uploads
// are sniffed and stored with their real type (docs/specs/009-elements/images.md), so this only matters
// for an object whose metadata was lost; bytes that match no accepted format
// get no data URL at all.
function dataUrlType(bytes: Uint8Array, declared: string | null): string | null {
  if (declared?.startsWith('image/')) return declared;
  return sniffImageType(bytes);
}

export async function embedTabImages(
  tab: Pick<Tab, 'elements'> & Partial<Pick<Tab, 'pages'>>,
  load: EmbedImageSource,
  limits: EmbedImageLimits = {},
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { maxBytesPerImage = Infinity, totalBudgetBytes, totalBudgetPixels, onOverLimit } = limits;
  let budget = totalBudgetBytes ?? Infinity;
  let pixelBudget = totalBudgetPixels ?? Infinity;

  // Read one image and, if it fits, add it. Returns nothing: every skip is
  // silent, because a placeholder is the right outcome for each of them.
  const embedOne = async (id: string): Promise<void> => {
    let loaded: Awaited<ReturnType<EmbedImageSource>>;
    try {
      loaded = await load(id);
    } catch {
      return;
    }
    if (!loaded) return;
    const size = loaded.bytes.byteLength;
    if (size > maxBytesPerImage || size > budget) {
      onOverLimit?.(id);
      return;
    }
    const bytes = new Uint8Array(loaded.bytes);
    const type = dataUrlType(bytes, loaded.contentType);
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

  const ids = tabImageIds(tab);
  if (totalBudgetBytes === undefined && totalBudgetPixels === undefined) {
    await Promise.all(ids.map(embedOne));
  } else {
    for (const id of ids) await embedOne(id);
  }
  return map;
}
