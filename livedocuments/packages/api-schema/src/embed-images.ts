// Inline a tab's uploaded images as base64 data URLs, so a server-side render
// shows the real picture instead of a placeholder box. Both workers render
// tabs: the api for the Explorer thumbnail + live share image (docs/specs/006-document/document-snapshots.md), the
// mcp for the PNG it hands the model (docs/specs/015-api/mcp-server.md §5). Neither renderer can fetch
// (resvg is WASM; a cached SVG must be self-contained), so each prefetches the
// bytes and passes a `resolveImageHref` that reads this map.
//
// The reading, the limits and their order are @liveworkspace/api-kit/embed-images, shared by every product; this
// file adds only which ids a tab references, which reads the product's element union.

import { pageImageIds, type Tab } from '@livedocuments/document';
import {
  embedImages,
  type EmbedImageLimits,
  type EmbedImageSource,
} from '@liveworkspace/api-kit/embed-images';

export type { EmbedImageSource };

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

// The tab's images as data URLs within the limits (@liveworkspace/api-kit/embed-images).
export function embedTabImages(
  tab: Pick<Tab, 'elements'> & Partial<Pick<Tab, 'pages'>>,
  load: EmbedImageSource,
  limits: EmbedImageLimits = {},
): Promise<Map<string, string>> {
  return embedImages(tabImageIds(tab), load, limits);
}
