// The browser's own text widths for the article estimate (docs/specs/007-editor/flashcards.md "Long stacks stay
// quick"): an unmounted flashcard's lines are broken where its editor would break them, each word measured by a
// canvas in the face the writing is drawn in. Widths are kept per face and text (most words repeat), the store
// dropped when it grows past MEASURE_CACHE_MAX, and when a web font finishes loading (a width read before it loaded
// was the fallback face's), which also moves `measureGeneration` on so cached estimates are made again.
import type { ArticleTextMeasure } from '@livedocuments/document';

// The most widths kept before the store starts again.
export const MEASURE_CACHE_MAX = 20_000;

type Ctx = { font: string; measureText(text: string): { width: number } };

const widths = new Map<string, number>();
let ctx: Ctx | null | undefined;
let generation = 0;
let watching = false;

function context(): Ctx | null {
  if (ctx !== undefined) return ctx;
  ctx = null;
  try {
    if (typeof OffscreenCanvas !== 'undefined')
      ctx = new OffscreenCanvas(1, 1).getContext('2d') ?? null;
    else if (typeof document !== 'undefined')
      ctx = document.createElement('canvas').getContext('2d') ?? null;
  } catch {
    ctx = null;
  }
  return ctx;
}

function watchFonts(): void {
  if (watching) return;
  watching = true;
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  fonts?.addEventListener?.('loadingdone', () => {
    widths.clear();
    generation++;
  });
}

// WebKit (Safari, and every browser on iOS) fits a line word by word; Blink and Gecko measure it whole. Chrome, Edge
// and Opera name Chrome/ or Chromium/ beside AppleWebKit; Chrome on iOS names CriOS and is WebKit.
export const fitsWordByWord = (userAgent: string): boolean =>
  userAgent.includes('AppleWebKit/') &&
  !userAgent.includes('Chrome/') &&
  !userAgent.includes('Chromium/');

/** What the estimate measures with in this browser, or undefined where nothing can measure (the estimate then keeps
 *  its average glyph). */
export function canvasTextMeasure(): ArticleTextMeasure | undefined {
  const c = context();
  if (!c) return undefined;
  watchFonts();
  const measure: ArticleTextMeasure = (text, font) => {
    const key = `${font}|${text}`;
    const hit = widths.get(key);
    if (hit !== undefined) return hit;
    if (c.font !== font) c.font = font;
    const w = c.measureText(text).width;
    if (widths.size >= MEASURE_CACHE_MAX) widths.clear();
    widths.set(key, w);
    return w;
  };
  measure.wordByWord = fitsWordByWord(typeof navigator !== 'undefined' ? navigator.userAgent : '');
  return measure;
}

/** Moves on each time a web font loads, so an estimate made with the fallback face is made again. */
export const measureGeneration = (): number => generation;

/** Forgets the context, the widths and the font watch (tests). */
export function resetCanvasTextMeasure(): void {
  widths.clear();
  ctx = undefined;
  generation = 0;
  watching = false;
}
