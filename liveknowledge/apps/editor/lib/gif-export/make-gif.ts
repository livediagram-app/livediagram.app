// Making the animated GIF (docs/specs/020-import-export/blueprints/animated-gif-export.md "The hook"): every page
// snapshotted once, the timeline's frames drawn one per task on a reused canvas and handed to the encoder, with
// progress after each and a stop between any two. A page's snapshot is dropped once no frame needs it.
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { GifEncoderSession } from './gif-encoder';
import { GifExportError } from './gif-export-error';
import { gifTimeline, type GifFrame, type GifTimelineInput } from './gif-timeline';
import type { FrameDrawer } from './page-frames';
import type { PageSnapshot } from './page-snapshot';

type MakeGifDeps = {
  // The page (by place among the GIF's pages) captured at the frame size.
  snapshot: (page: number) => Promise<PageSnapshot>;
  drawer: FrameDrawer;
  encoder: GifEncoderSession;
  // A moment for the editor between frames (D52).
  yieldToPage?: () => Promise<void>;
};

type MakeGifInput = Omit<GifTimelineInput, 'stillPages'> & {
  signal: AbortSignal;
  onProgress: (fraction: number) => void;
};

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** The GIF's bytes. Rejects with an AbortError when stopped, a GifExportError otherwise. */
export async function makeGif(
  input: MakeGifInput,
  { snapshot, drawer, encoder, yieldToPage = nextTask }: MakeGifDeps,
): Promise<{ bytes: Uint8Array; frames: GifFrame[]; written: number }> {
  const { signal, onProgress, ...timeline } = input;
  const started = performance.now();
  const stop = () => {
    if (signal.aborted) throw new DOMException('GIF cancelled', 'AbortError');
  };
  try {
    // Every page first: whether it moves decides how many frames it has.
    const snaps = new Map<number, PageSnapshot>();
    for (let page = 0; page < timeline.pageCount; page += 1) {
      stop();
      snaps.set(page, await snapshot(page));
    }
    const stillPages = new Set([...snaps].filter(([, s]) => !s.animated).map(([page]) => page));
    const frames = gifTimeline({ ...timeline, stillPages });
    debugLog(
      `[gif-export] start pages=${timeline.pageCount} hold=${timeline.holdSeconds} frames=${frames.length}`,
    );
    const snapshotOf = (page: number) => snaps.get(page)!;
    // Each page's palette, from its frames across the hold (a transition frame keeps its own).
    for (let page = 0; page < timeline.pageCount; page += 1) {
      const samples: Uint8ClampedArray[] = [];
      for (const frame of paletteSamples(frames, page)) {
        stop();
        samples.push(await drawer.draw(frame, snapshotOf));
      }
      if (samples.length) encoder.palette(page, samples);
      await yieldToPage();
    }
    const lastUse = lastUses(frames);
    for (const [i, frame] of frames.entries()) {
      stop();
      const rgba = await drawer.draw(frame, snapshotOf);
      encoder.add(rgba, frame.delayCs, frame.from ? undefined : frame.page);
      for (const [page, last] of lastUse) if (last === i) snaps.delete(page);
      onProgress((i + 1) / frames.length);
      await yieldToPage();
    }
    stop();
    const { bytes, written } = await encoder.finish();
    // A Cancel while the file was being finished still discards it.
    stop();
    debugLog(
      `[gif-export] done frames=${written} bytes=${bytes.length} ms=${Math.round(performance.now() - started)}`,
    );
    return { bytes, frames, written };
  } catch (err) {
    encoder.cancel();
    if (signal.aborted) {
      debugLog('[gif-export] cancelled');
      throw new DOMException('GIF cancelled', 'AbortError');
    }
    const code = err instanceof GifExportError ? err.code : 'failed';
    debugLog(`[gif-export] failed ${code}`, err);
    throw err instanceof GifExportError ? err : new GifExportError('failed');
  }
}

// A page's palette is chosen from these of its frames: its first, middle and last outside a transition.
const PALETTE_SAMPLES = 3;

export function paletteSamples(frames: readonly GifFrame[], page: number): GifFrame[] {
  const own = frames.filter((f) => f.page === page && !f.from);
  if (own.length <= PALETTE_SAMPLES) return own;
  const picks = new Set([0, Math.floor((own.length - 1) / 2), own.length - 1]);
  return [...picks].map((i) => own[i]!);
}

// The last frame each page is drawn in (itself, or as the outgoing page of a transition).
function lastUses(frames: readonly GifFrame[]): Map<number, number> {
  const last = new Map<number, number>();
  frames.forEach((f, i) => {
    last.set(f.page, i);
    if (f.from) last.set(f.from.page, i);
  });
  return last;
}
