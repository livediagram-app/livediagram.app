// The animated GIF export's timeline (docs/specs/020-import-export/animated-gif-export.md "The timeline"): which page
// each frame shows, at what moment of that page's clock, how far through a transition it is, and how long it stays.
// Pure: the capture and the encoder follow it frame by frame.
import { cubicBezier } from '@/lib/page-motion-frame';
import type { SlideTransition } from '@/lib/presentation-config';

export const GIF_FPS = 15;
export const GIF_HOLD_MIN_S = 1;
export const GIF_HOLD_MAX_S = 20;
export const GIF_HOLD_STEP_S = 0.5;
const GIF_HOLD_DEFAULT_S = 3;
// The longest GIF, every page's hold added up.
const GIF_MAX_TOTAL_S = 180;
// Past this the panel suggests a smaller GIF.
export const GIF_LARGE_BYTES = 15_000_000;

export type GifSize = 'small' | 'medium' | 'large';
// A frame's longer side at each size.
const GIF_SIZE_LONG_SIDE: Record<GifSize, number> = {
  small: 480,
  medium: 960,
  large: 1440,
};
export const GIF_SIZES: readonly { id: GifSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
];

// The presenting transitions' own curves (app/canvas-motion.css lvd-slide-forward, lvd-slide-fade).
const SLIDE_EASE = cubicBezier(0.4, 0, 0.2, 1);
const FADE_EASE = cubicBezier(0.25, 0.1, 0.25, 1);

/** One frame: `page` at `t` ms of its clock; under a transition, `from` is the outgoing page at its own clock and
 *  `mix` (0 to 1, eased) how far the incoming page has come. `delayCs` is how long it shows, in centiseconds. */
export type GifFrame = {
  page: number;
  t: number;
  from?: { page: number; t: number };
  mix: number;
  delayCs: number;
};

export type GifTimelineInput = {
  pageCount: number;
  holdSeconds: number;
  transition: SlideTransition;
  transitionMs: number;
  // Pages (by place) with nothing moving on them.
  stillPages: ReadonlySet<number>;
  // All pages with two or more: the pages come round in turn, with a transition between each (the last back to
  // the first included). False for One page.
  loops: boolean;
};

/** Every frame of the GIF, in order. */
export function gifTimeline({
  pageCount,
  holdSeconds,
  transition,
  transitionMs,
  stillPages,
  loops,
}: GifTimelineInput): GifFrame[] {
  const holdMs = Math.round(holdSeconds * 1000);
  const holdCs = Math.round(holdMs / 10);
  const moves = loops && pageCount > 1 && transition !== 'none';
  // Every page is seen still for at least half its hold.
  const tr = moves ? Math.min(transitionMs, holdMs / 2) : 0;
  const ease = transition === 'fade' ? FADE_EASE : SLIDE_EASE;
  const perPage = Math.ceil((holdMs * GIF_FPS) / 1000);
  const frameMs = (k: number) => Math.round((k * 1000) / GIF_FPS);
  const frameCs = (k: number) => Math.round((k * 100) / GIF_FPS);
  const frames: GifFrame[] = [];
  for (let page = 0; page < pageCount; page += 1) {
    // Within the page: the frame index k each frame starts at.
    const starts: { k: number; frame: Omit<GifFrame, 'delayCs'> }[] = [];
    const still = stillPages.has(page);
    for (let k = 0; k < perPage; k += 1) {
      const t = frameMs(k);
      if (t < tr) {
        const prev = (page - 1 + pageCount) % pageCount;
        starts.push({
          k,
          frame: { page, t, from: { page: prev, t: holdMs + t }, mix: ease(t / tr) },
        });
        continue;
      }
      starts.push({ k, frame: { page, t, mix: 1 } });
      // A still page shows its first settled frame for the rest of its hold.
      if (still) break;
    }
    starts.forEach(({ k, frame }, i) => {
      const end = i + 1 < starts.length ? frameCs(starts[i + 1]!.k) : holdCs;
      frames.push({ ...frame, delayCs: end - frameCs(k) });
    });
  }
  return frames;
}

/** How long the GIF runs, in seconds. */
const gifTotalSeconds = (pageCount: number, holdSeconds: number): number => pageCount * holdSeconds;

/** Past the longest GIF. */
export const gifTooLong = (pageCount: number, holdSeconds: number): boolean =>
  gifTotalSeconds(pageCount, holdSeconds) > GIF_MAX_TOTAL_S;

/** Where the hold starts: the deck's Auto-advance when it is on, within the slider's range; else three seconds. */
export function gifHoldDefault(autoAdvanceSeconds: number): number {
  if (!(autoAdvanceSeconds > 0)) return GIF_HOLD_DEFAULT_S;
  return Math.min(GIF_HOLD_MAX_S, Math.max(GIF_HOLD_MIN_S, autoAdvanceSeconds));
}

/** A frame's pixel size: the page's longer side at the size's length, the other in proportion. */
export function gifFrameSize(
  page: { width: number; height: number },
  size: GifSize,
): { width: number; height: number } {
  const long = GIF_SIZE_LONG_SIDE[size];
  const landscape = page.width >= page.height;
  const ratio = landscape ? page.height / page.width : page.width / page.height;
  const short = Math.max(1, Math.round(long * ratio));
  return landscape ? { width: long, height: short } : { width: short, height: long };
}

/** The estimate's words: "About 3.4 MB", or in KB under one MB. */
export function gifSizeLabel(bytes: number): string {
  if (bytes < 1_000_000) return `About ${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `About ${(bytes / 1_000_000).toFixed(1)} MB`;
}
