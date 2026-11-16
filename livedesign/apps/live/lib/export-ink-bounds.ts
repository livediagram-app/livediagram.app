// Ink past a text's box (docs/specs/020-import-export/export-fidelity.md "Ink past a text's box is kept"): a
// typeface can draw past the box its text is laid out in (a script face's swash, an italic's lean), which the SVG
// export keeps and a raster cut to the box would cut flat. The PNG / PDF path measures each rasterised text's real
// ink once, at 1x, and pads its raster (and, cut to content, the export's bounds) by just that.

/** A rectangle in tab coordinates. */
export type InkRect = { x: number; y: number; w: number; h: number };

type Box = { x: number; y: number; width: number; height: number };

// The margin a measure draws round the box, one font size each side: a swash or a lean reaches well under an em
// past its line. Clamped so a tiny label still has room and a huge one never makes a huge probe canvas.
export const INK_PROBE_MIN_PX = 16;
export const INK_PROBE_MAX_PX = 256;

// The measure draws at 1x, so a part pixel of ink can round either way: one more pixel covers it.
const INK_ROUNDING_PX = 1;

/** The margin the ink measure draws round a text of this font size, in canvas px. */
export function inkProbeMargin(fontSize: number): number {
  const size = Number.isFinite(fontSize) ? Math.ceil(fontSize) : 0;
  return Math.min(INK_PROBE_MAX_PX, Math.max(INK_PROBE_MIN_PX, size));
}

/**
 * The drawn pixels in an RGBA buffer (any alpha above 0), as a rectangle in the buffer's own pixels: the first and
 * last row and column with ink, exclusive at the far side. Null when nothing is drawn.
 */
export function alphaInkRect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const inked = (row: number) => {
    for (let i = row * width * 4 + 3, end = (row + 1) * width * 4; i < end; i += 4)
      if (data[i]! > 0) return true;
    return false;
  };
  let y0 = 0;
  while (y0 < height && !inked(y0)) y0++;
  if (y0 === height) return null;
  let y1 = height;
  while (!inked(y1 - 1)) y1--;
  let x0 = width;
  let x1 = 0;
  for (let y = y0; y < y1; y++) {
    const row = y * width * 4 + 3;
    for (let x = 0; x < x0; x++)
      if (data[row + x * 4]! > 0) {
        x0 = x;
        break;
      }
    for (let x = width - 1; x >= x1; x--)
      if (data[row + x * 4]! > 0) {
        x1 = x + 1;
        break;
      }
  }
  return { x0, y0, x1, y1 };
}

/**
 * A text raster's pad: the base pad (2 px, the turn's sweep, a shadow), grown only when the measured ink reaches
 * farther past the box than that, to the ink's farthest reach plus a pixel for the measure's rounding.
 */
export function inkRasterPad(box: Box, ink: InkRect | null, basePad: number): number {
  if (!ink) return basePad;
  const reach = Math.max(
    box.x - ink.x,
    box.y - ink.y,
    ink.x + ink.w - (box.x + box.width),
    ink.y + ink.h - (box.y + box.height),
  );
  return reach > basePad ? Math.ceil(reach) + INK_ROUNDING_PX : basePad;
}

/** Bounds grown to take in every ink rectangle (with the measure's rounding pixel), never shrunk. */
export function boundsWithInk(bounds: InkRect, inks: readonly InkRect[]): InkRect {
  let x0 = bounds.x;
  let y0 = bounds.y;
  let x1 = bounds.x + bounds.w;
  let y1 = bounds.y + bounds.h;
  for (const ink of inks) {
    x0 = Math.min(x0, Math.floor(ink.x) - INK_ROUNDING_PX);
    y0 = Math.min(y0, Math.floor(ink.y) - INK_ROUNDING_PX);
    x1 = Math.max(x1, Math.ceil(ink.x + ink.w) + INK_ROUNDING_PX);
    y1 = Math.max(y1, Math.ceil(ink.y + ink.h) + INK_ROUNDING_PX);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

type ProbeContext = Pick<CanvasRenderingContext2D, 'clearRect' | 'drawImage' | 'getImageData'>;
type ProbeCanvas = {
  width: number;
  height: number;
  getContext: (kind: '2d', opts: object) => unknown;
};

/**
 * Measures one element's ink: its SVG fragment (drawn at 1x over `area`, in tab coordinates) is loaded, painted
 * onto a reused probe canvas and read back. Null when the browser refuses any step (a canvas it will not read
 * back, a fragment it will not load): the caller keeps the box, as before.
 */
export async function measureInk(
  svg: string,
  area: InkRect,
  load: (svg: string) => Promise<CanvasImageSource>,
  probe: ProbeCanvas,
): Promise<InkRect | null> {
  const width = Math.max(1, Math.ceil(area.w));
  const height = Math.max(1, Math.ceil(area.h));
  try {
    const image = await load(svg);
    probe.width = width;
    probe.height = height;
    const ctx = probe.getContext('2d', { willReadFrequently: true }) as ProbeContext | null;
    if (!ctx) return null;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const px = alphaInkRect(ctx.getImageData(0, 0, width, height).data, width, height);
    return px ? { x: area.x + px.x0, y: area.y + px.y0, w: px.x1 - px.x0, h: px.y1 - px.y0 } : null;
  } catch {
    return null;
  }
}
