import { BLUR_JPEG_QUALITY, blurCopyPlan, paintBlurredCopy } from './page-image-blur-core';
import type { BlurCopyRequest, BlurCopyResponse } from './page-image-blur-protocol';

// The page picture Blur's worker (docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur): it fetches the
// picture, decodes it, draws it small on an OffscreenCanvas, blurs it and encodes the JPEG, all off the main thread,
// so letting go of a stronger Blur on a large picture never holds the editor (it took up to about 130 ms there).

const scope = self as unknown as {
  postMessage: (message: BlurCopyResponse) => void;
  addEventListener: (type: 'message', fn: (e: MessageEvent<BlurCopyRequest>) => void) => void;
};

/** One copy: the picture at `src` fetched and blurred for `page` by `sigma`, as a JPEG. */
export async function makeBlurCopy({
  src,
  page,
  sigma,
}: Omit<BlurCopyRequest, 'id'>): Promise<Blob> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  try {
    const plan = blurCopyPlan({ width: bitmap.width, height: bitmap.height }, page, sigma);
    const canvas = new OffscreenCanvas(plan.width, plan.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    paintBlurredCopy(ctx, bitmap, plan);
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: BLUR_JPEG_QUALITY });
  } finally {
    bitmap.close();
  }
}

scope.addEventListener('message', ({ data }) => {
  void makeBlurCopy(data).then(
    (blob) => scope.postMessage({ id: data.id, blob }),
    (err: unknown) => scope.postMessage({ id: data.id, failed: String(err) }),
  );
});
