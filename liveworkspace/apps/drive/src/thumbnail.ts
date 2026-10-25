// A file's thumbnail (liveworkspace/docs/drive.md "The file"): the app's `svg` export of the item's first tab, drawn
// as a PNG DRIVE_THUMBNAIL_PX on its long side by the shared resvg renderer, sent as contentHints.thumbnail. The
// renderer (about 3 MB of wasm and fonts) is imported on first use, so the many suites and requests that never draw
// don't load it, as the media service's share card does.

import {
  bytesToBase64Url,
  DRIVE_THUMBNAIL_MAX_BYTES,
  DRIVE_THUMBNAIL_PX,
} from '@liveworkspace/drive';

/** URL-safe base64 PNG, or null when there is nothing to send. */
export type Rasterise = (svg: string) => Promise<string | null>;

export const workerRasterise: Rasterise = async (svg) => {
  const { workerPngRenderer } = await import('@liveworkspace/render-png/worker');
  // The bound shrinks a big drawing; a small one is drawn again larger, since Google wants 220 px or more.
  let image = await workerPngRenderer.renderPng(svg, 1, DRIVE_THUMBNAIL_PX);
  const side = Math.max(image.width, image.height);
  if (side > 0 && side < DRIVE_THUMBNAIL_PX) {
    image = await workerPngRenderer.renderPng(svg, DRIVE_THUMBNAIL_PX / side, DRIVE_THUMBNAIL_PX);
  }
  if (image.png.byteLength === 0 || image.png.byteLength > DRIVE_THUMBNAIL_MAX_BYTES) return null;
  return bytesToBase64Url(image.png);
};
