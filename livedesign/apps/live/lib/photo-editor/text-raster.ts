// A text layer drawn into pixels (docs/specs/031-photo/photo-layers.md "A layer", Text): its words in
// its font, size, weight, colour, alignment, line height and tracking, wrapped at its box's width,
// anti-aliased. Used by both renderers: the CPU composite (a rect of it) and the GPU's content cache
// (the whole of it as tiles).
import { resolveFontStack } from '@livedesign/design';
import {
  createRaster,
  hexToBytes,
  TiledRaster,
  type Raster,
  type Rect,
  type TextLayer,
  type TextRasterizer,
} from '@livedesign/photo-engine';

const SANS = 'Inter, ui-sans-serif, system-ui, sans-serif';

export function textFont(spec: TextLayer['text']): string {
  return `${spec.italic ? 'italic ' : ''}${spec.weight} ${spec.size}px ${resolveFontStack(spec.font) ?? SANS}`;
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function context(width: number, height: number): { ctx: Ctx2D; read: () => Raster } {
  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    return { ctx, read: () => ({ width: w, height: h, data: ctx.getImageData(0, 0, w, h).data }) };
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  return { ctx, read: () => ({ width: w, height: h, data: ctx.getImageData(0, 0, w, h).data }) };
}

type Measurer = { measureText: (text: string) => { width: number } };

// Where no canvas can be made (a test, a worker without OffscreenCanvas): an average glyph's width.
const ESTIMATED_GLYPH_EM = 0.55;

function measurer(spec: TextLayer['text']): Measurer {
  if (typeof OffscreenCanvas === 'undefined' && typeof document === 'undefined')
    return {
      measureText: (t) => ({
        width: t.length * spec.size * (ESTIMATED_GLYPH_EM + (spec.tracking ?? 0)),
      }),
    };
  const probe = context(1, 1).ctx;
  withTracking(probe, spec);
  return probe;
}

/** The text's lines: its own line breaks, then wrapped at the box's width (when it has one). */
export function textLines(ctx: Measurer, spec: TextLayer['text']): string[] {
  const lines: string[] = [];
  for (const para of spec.text.split('\n')) {
    if (!spec.boxWidth) {
      lines.push(para);
      continue;
    }
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (line && ctx.measureText(next).width > spec.boxWidth) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

function withTracking(ctx: Ctx2D, spec: TextLayer['text']): void {
  ctx.font = textFont(spec);
  if ('letterSpacing' in ctx)
    (ctx as { letterSpacing: string }).letterSpacing = `${(spec.tracking ?? 0) * spec.size}px`;
}

type Layout = {
  lines: string[];
  lineHeight: number;
  widest: number;
  width: number;
  height: number;
};

function layout(spec: TextLayer['text']): Layout {
  const probe = measurer(spec);
  const lines = textLines(probe, spec);
  const lineHeight = spec.size * (spec.lineHeight ?? 1.2);
  const widest = Math.max(1, ...lines.map((l) => probe.measureText(l).width));
  const width = Math.ceil(spec.boxWidth ?? widest) + Math.ceil(spec.size * 0.5);
  const height = Math.ceil(lineHeight * lines.length + spec.size * 0.3);
  return { lines, lineHeight, widest, width, height };
}

/** The rect a text layer's picture covers, in photo px (for a press on it, and its box). */
export function textBox(layer: TextLayer): Rect {
  const { width, height } = layout(layer.text);
  return { x: layer.text.at.x, y: layer.text.at.y, width, height };
}

/** The text drawn, and where its picture's top-left sits in the photo. */
export function drawText(layer: TextLayer): { raster: Raster; x: number; y: number } {
  const spec = layer.text;
  const { lines, lineHeight, widest, width, height } = layout(spec);
  const { ctx, read } = context(width, height);
  withTracking(ctx, spec);
  const [r, g, b] = hexToBytes(spec.colour);
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.textBaseline = 'alphabetic';
  const box = spec.boxWidth ?? widest;
  ctx.textAlign = spec.align === 'centre' ? 'center' : spec.align === 'right' ? 'right' : 'left';
  const x = spec.align === 'centre' ? box / 2 : spec.align === 'right' ? box : 0;
  lines.forEach((line, i) => ctx.fillText(line, x, lineHeight * i + spec.size * 0.95));
  return { raster: read(), x: spec.at.x, y: spec.at.y };
}

/** A text layer as tiles in photo coordinates (the GPU's content). */
export function textTiles(layer: TextLayer): TiledRaster {
  const { raster, x, y } = drawText(layer);
  return TiledRaster.fromRaster(raster, x, y);
}

/** The CPU composite's text: the text layer drawn over a rect of the photo. */
export const rasterizeText: TextRasterizer = (layer, rect: Rect) => {
  const { raster, x, y } = drawText(layer);
  const out = createRaster(rect.width, rect.height);
  for (let row = 0; row < raster.height; row++) {
    const oy = y + row - rect.y;
    if (oy < 0 || oy >= rect.height) continue;
    for (let col = 0; col < raster.width; col++) {
      const ox = x + col - rect.x;
      if (ox < 0 || ox >= rect.width) continue;
      const si = (row * raster.width + col) * 4;
      out.data.set(raster.data.subarray(si, si + 4), (oy * rect.width + ox) * 4);
    }
  }
  return out;
};
