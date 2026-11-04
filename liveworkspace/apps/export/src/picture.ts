// A tab's picture (liveworkspace/docs/specs/003-accounts/data-export.md "What is in the zip"): the app's `svg` export
// drawn as a PNG by the platform's shared resvg renderer, at twice its size and at most EXPORT_PICTURE_MAX_SIDE on its
// long side. The renderer (about 3 MB of wasm and fonts) is imported on first use, as the Drive mirror's thumbnail is.

import { EXPORT_PICTURE_MAX_SIDE, EXPORT_PICTURE_SCALE } from '@liveworkspace/data-export';
import type { Rasterise } from './job/steps';

export const workerRasterise: Rasterise = async (svg) => {
  const { workerPngRenderer } = await import('@liveworkspace/render-png/worker');
  const image = await workerPngRenderer.renderPng(
    svg,
    EXPORT_PICTURE_SCALE,
    EXPORT_PICTURE_MAX_SIDE,
  );
  return image.png.byteLength > 0 ? image.png : null;
};
