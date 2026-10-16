// A page picture's tone (docs/specs/007-editor/illustrate-pages.md "Image backgrounds"): its
// average colour, sampled once when it is picked by drawing it down to a few pixels. What the page's
// ink is chosen against. Browser-only (Image, canvas); its averaging is pure and tested.

// The side the picture is drawn down to: enough to average, nothing to decode twice.
export const PAGE_IMAGE_TONE_SAMPLE = 16;
// A slow picture is not waited for: the page reads as mid grey instead.
const TONE_TIMEOUT_MS = 4000;

/** The mean colour of RGBA pixels as a hex, weighting each by its opacity; null for none. */
export function averageTone(data: ArrayLike<number>): string | null {
  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const a = data[i + 3]! / 255;
    r += data[i]! * a;
    g += data[i + 1]! * a;
    b += data[i + 2]! * a;
    w += a;
  }
  if (w === 0) return null;
  const hex = (v: number) =>
    Math.round(v / w)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** The tone of the picture at `src` (a blob, data or cross-origin readable URL), or undefined when
 *  it cannot be read in time (the page then reads as mid grey). Never throws. */
export function sampleImageTone(src: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const timer = setTimeout(() => resolve(undefined), TONE_TIMEOUT_MS);
    const done = (tone: string | undefined) => {
      clearTimeout(timer);
      resolve(tone);
    };
    img.onload = () => {
      try {
        const n = PAGE_IMAGE_TONE_SAMPLE;
        const canvas = document.createElement('canvas');
        canvas.width = n;
        canvas.height = n;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return done(undefined);
        ctx.drawImage(img, 0, 0, n, n);
        done(averageTone(ctx.getImageData(0, 0, n, n).data) ?? undefined);
      } catch {
        // A tainted canvas (a host that would not share its pixels).
        console.warn('[illustrate-page] picture tone unreadable');
        done(undefined);
      }
    };
    img.onerror = () => done(undefined);
    img.src = src;
  });
}
