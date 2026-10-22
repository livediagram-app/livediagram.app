// The animated GIF export's frames (docs/specs/020-import-export/blueprints/animated-gif-export.md "Frames"): each
// timeline frame drawn from the page snapshots onto one reused canvas and read back as RGBA for the encoder.
import { GifExportError } from './gif-export-error';
import type { GifFrame } from './gif-timeline';
import type { PageSnapshot } from './page-snapshot';

// A logo page's see-through paper exports white (GIF transparency is one bit and fringes every soft edge).
const PAPER = '#ffffff';

/** The 2D context calls a frame's composition makes. */
export type FrameContext = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'globalAlpha' | 'fillRect' | 'drawImage'
>;

/** Lay one frame out: the outgoing page under a transition, then the incoming one (the page at `frame.t`). */
export function composeFrame(
  ctx: FrameContext,
  frame: GifFrame,
  transition: 'fade' | 'slide' | 'none',
  width: number,
  height: number,
  pages: { incoming: CanvasImageSource; outgoing?: CanvasImageSource },
): void {
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  const { incoming, outgoing } = pages;
  if (!frame.from || !outgoing || transition === 'none') {
    ctx.drawImage(incoming, 0, 0, width, height);
    return;
  }
  if (transition === 'fade') {
    ctx.drawImage(outgoing, 0, 0, width, height);
    ctx.globalAlpha = frame.mix;
    ctx.drawImage(incoming, 0, 0, width, height);
    ctx.globalAlpha = 1;
    return;
  }
  // Slide: the outgoing page travels out to the left as the incoming one comes in from the right.
  const shift = Math.round(frame.mix * width);
  ctx.drawImage(outgoing, -shift, 0, width, height);
  ctx.drawImage(incoming, width - shift, 0, width, height);
}

/** An SVG `data:` URL as a decoded image. */
export async function loadSvg(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch {
    throw new GifExportError('failed');
  }
  return img;
}

export type FrameDrawer = {
  /** The frame as RGBA (a fresh buffer each time: it is handed to the encoder). */
  draw(frame: GifFrame, snapshotOf: (page: number) => PageSnapshot): Promise<Uint8ClampedArray>;
};

/** One canvas for every frame of an export. */
export function createFrameDrawer(
  width: number,
  height: number,
  transition: 'fade' | 'slide' | 'none',
  doc: Document = document,
): FrameDrawer {
  const canvas = doc.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new GifExportError('failed');
  return {
    async draw(frame, snapshotOf) {
      const [incoming, outgoing] = await Promise.all([
        loadSvg(snapshotOf(frame.page).urlAt(frame.t)),
        frame.from ? loadSvg(snapshotOf(frame.from.page).urlAt(frame.from.t)) : undefined,
      ]);
      composeFrame(ctx, frame, transition, width, height, { incoming, outgoing });
      try {
        return ctx.getImageData(0, 0, width, height).data;
      } catch {
        // The browser drew the image but will not hand its pixels back.
        throw new GifExportError('tainted');
      }
    },
  };
}
