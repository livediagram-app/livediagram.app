'use client';

// The blurred copy a page's picture paints from on the canvas (docs/specs/007-editor/pages-mode.md "Image
// backgrounds", Blur): asked for once per picture, page size and strength, held while the sheet shows it, null
// (the tone shows) until it is ready.
import { useEffect, useRef, useState } from 'react';
import { acquireBlurredImage } from '@/lib/page-image-blur';

// How long a changed strength waits before its copy is made.
export const BLUR_SETTLE_MS = 150;

export function useBlurredPageImage(
  src: string | undefined,
  page: { width: number; height: number },
  sigma: number,
): string | null {
  const [shown, setShown] = useState<{ key: string; url: string | null } | null>(null);
  const { width, height } = page;
  const key = src && sigma > 0 ? `${src}|${width}|${height}|${sigma}` : null;
  // Whether a copy has shown yet (a ref, so it picks the delay without asking again by itself).
  const showing = useRef(false);
  useEffect(() => {
    if (!src || sigma <= 0) return;
    let live = true;
    let held: ReturnType<typeof acquireBlurredImage> | null = null;
    // The first copy is asked for at once; a new strength while one shows (a Blur drag) waits for the slider to
    // settle, so a drag makes one copy, not one per step.
    const ask = () => {
      held = acquireBlurredImage(src, { width, height }, sigma);
      void held.url.then((url) => {
        if (!live) return;
        showing.current = true;
        setShown({ key: `${src}|${width}|${height}|${sigma}`, url });
      });
    };
    const timer = showing.current ? setTimeout(ask, BLUR_SETTLE_MS) : undefined;
    if (!showing.current) ask();
    return () => {
      live = false;
      clearTimeout(timer);
      held?.release();
    };
  }, [src, width, height, sigma]);
  // The last copy keeps showing while the next one is made (a Blur drag), never the sharp picture.
  if (!key) return null;
  return shown?.url ?? null;
}
