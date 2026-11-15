// The page picture Blur's worker side (docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur, in livedocuments
// and livedesign): it fetches the picture, decodes it, draws it small on an OffscreenCanvas, blurs it and encodes the
// JPEG, all off the main thread, so letting go of a stronger Blur on a large picture never holds the editor (it took up
// to about 130 ms there). Each editor's own worker entry (lib/page-image-blur.worker.ts) calls serveBlurCopies, so the
// bundler sees the worker beside the code that starts it.
import {
  BLUR_JPEG_QUALITY,
  blurCopyPlan,
  paintBlurredCopy,
  type BlurCopyRequest,
  type BlurCopyResponse,
} from './image-blur';

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

/** What a worker's global scope offers here. */
export type BlurWorkerScope = {
  postMessage: (message: BlurCopyResponse) => void;
  addEventListener: (type: 'message', fn: (e: MessageEvent<BlurCopyRequest>) => void) => void;
};

/** Answers every copy asked of this worker: the JPEG, or why it failed. */
export function serveBlurCopies(scope: BlurWorkerScope): void {
  scope.addEventListener('message', ({ data }) => {
    void makeBlurCopy(data).then(
      (blob) => scope.postMessage({ id: data.id, blob }),
      (err: unknown) => scope.postMessage({ id: data.id, failed: String(err) }),
    );
  });
}
