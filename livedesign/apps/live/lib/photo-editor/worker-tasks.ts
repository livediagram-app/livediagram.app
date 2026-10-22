// The work a photo page sends off the main thread (docs/specs/031-photo/blueprints/photo-engine.md
// "Web Experience" INP): encoding tiles and previews, decoding pictures, filters, smart selections
// and content-aware fill. One handler, run in the photo worker, or on the page where a worker cannot
// start, so both give the same answer.
import {
  contentAwareFill,
  decodePng,
  encodePngStream,
  FILTERS,
  FilterCancelled,
  quickSelect,
  refineEdge,
  selectSubject,
  type FilterContext,
  type Mask8,
  type Raster,
} from '@livedesign/photo-engine';

export type PhotoTask =
  | {
      kind: 'encode';
      width: number;
      height: number;
      data: Uint8ClampedArray;
      type: 'image/png' | 'image/webp' | 'image/jpeg';
      quality?: number;
    }
  | { kind: 'decode'; bytes: Uint8Array; type: string }
  | {
      kind: 'filter';
      id: string;
      params: Record<string, unknown>;
      raster: Raster;
      ctx: Omit<FilterContext, 'signal' | 'progress'>;
    }
  | { kind: 'subject'; raster: Raster }
  | {
      kind: 'quick-select';
      raster: Raster;
      current: Mask8 | null;
      painted: Mask8;
      subtract: boolean;
    }
  | { kind: 'refine'; raster: Raster; mask: Mask8; radius: number }
  | { kind: 'fill'; raster: Raster; hole: Uint8Array; seed: number };

export type PhotoTaskResult =
  | { kind: 'encode'; bytes: Uint8Array }
  | { kind: 'decode'; raster: Raster }
  | { kind: 'filter'; raster: Raster }
  | { kind: 'mask'; mask: Uint8Array }
  | { kind: 'selection'; selection: Mask8 }
  | { kind: 'fill'; raster: Raster };

type Canvas2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function canvasOf(
  width: number,
  height: number,
): { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: Canvas2D } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true })! };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true })! };
}

async function toBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality),
  );
}

export async function encodePixels(
  width: number,
  height: number,
  data: Uint8ClampedArray,
  type: 'image/png' | 'image/webp' | 'image/jpeg',
  quality?: number,
): Promise<Uint8Array> {
  // A PNG is written by the engine: straight alpha kept exactly (a canvas premultiplies, losing the
  // colour of faint pixels), and no canvas needed.
  if (type === 'image/png') {
    const blob = await encodePngStream(width, height, (y, rows) => ({
      width,
      height: rows,
      data: data.subarray(y * width * 4, (y + rows) * width * 4),
    }));
    return new Uint8Array(await blob.arrayBuffer());
  }
  const { canvas, ctx } = canvasOf(width, height);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  const blob = await toBlob(canvas, type, quality);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function decodePixels(bytes: Uint8Array, type: string): Promise<Raster> {
  // The tiles we wrote (and most PNGs) decode exactly; anything else through the platform.
  if (type === 'image/png') {
    const exact = await decodePng(bytes);
    if (exact) return exact;
  }
  // Straight alpha, no colour management: the pixels as stored.
  const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }), {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });
  const { ctx } = canvasOf(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return { width: img.width, height: img.height, data: img.data };
}

export async function runPhotoTask(
  task: PhotoTask,
  signal?: AbortSignal,
  progress?: (done: number) => void,
): Promise<PhotoTaskResult> {
  switch (task.kind) {
    case 'encode':
      return {
        kind: 'encode',
        bytes: await encodePixels(task.width, task.height, task.data, task.type, task.quality),
      };
    case 'decode':
      return { kind: 'decode', raster: await decodePixels(task.bytes, task.type) };
    case 'filter': {
      const def = FILTERS[task.id];
      if (!def) throw new Error(`no filter ${task.id}`);
      return {
        kind: 'filter',
        raster: def.run(task.raster, task.params, { ...task.ctx, signal, progress }),
      };
    }
    case 'subject':
      return { kind: 'mask', mask: selectSubject(task.raster) };
    case 'quick-select':
      return {
        kind: 'selection',
        selection: quickSelect(task.raster, task.current, task.painted, {
          subtract: task.subtract,
        }),
      };
    case 'refine':
      return { kind: 'selection', selection: refineEdge(task.raster, task.mask, task.radius) };
    case 'fill':
      return {
        kind: 'fill',
        raster: contentAwareFill(task.raster, task.hole, { seed: task.seed }),
      };
  }
}

export { FilterCancelled };

/** The buffers a result can move rather than copy. */
export function transfersOf(r: PhotoTaskResult | PhotoTask): Transferable[] {
  switch (r.kind) {
    case 'encode':
      return 'bytes' in r ? [r.bytes.buffer as ArrayBuffer] : [r.data.buffer as ArrayBuffer];
    case 'decode':
      return 'raster' in r ? [r.raster.data.buffer as ArrayBuffer] : [];
    case 'filter':
    case 'fill':
      return [r.raster.data.buffer as ArrayBuffer];
    case 'mask':
      return [r.mask.buffer as ArrayBuffer];
    default:
      return [];
  }
}
