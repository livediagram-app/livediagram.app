import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { crc32, deflateSync } from 'node:zlib';
import { randomFillSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { embedTabImages } from '@livedesign/api-schema';
import { renderElementsToSvg, type Tab } from '@livedesign/design';
import { createPngRenderer } from '@liveworkspace/render-png';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import {
  PREVIEW_IMAGE_BUDGET_BYTES,
  PREVIEW_IMAGE_BUDGET_PIXELS,
  PREVIEW_IMAGE_MAX_BYTES,
  PREVIEW_MAX_SIDE_PX,
  previewLeftOutNote,
} from '@liveworkspace/mcp-kit/preview-budget';

// The picture budget holds a preview inside a Worker (docs/specs/015-api/mcp-server.md §5 "Picture budget"): the
// worst page it lets through, drawn by the real resvg, must stay within the memory a Worker has, and draw in time.

// resvg's wasm memory, caught as the renderer instantiates it: it only grows, so after a render it is the peak.
let wasmMemory: WebAssembly.Memory | undefined;
const instantiate = WebAssembly.instantiate.bind(WebAssembly);
WebAssembly.instantiate = (async (...args: Parameters<typeof WebAssembly.instantiate>) => {
  const made = (await instantiate(...args)) as
    WebAssembly.Instance | { instance: WebAssembly.Instance };
  const instance = 'instance' in made ? made.instance : made;
  wasmMemory = instance.exports.memory as WebAssembly.Memory;
  return made;
}) as typeof WebAssembly.instantiate;

const require = createRequire(import.meta.url);
const renderer = createPngRenderer({
  wasm: () => readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')),
  font: () => readFile(require.resolve('@liveworkspace/render-png/fonts/Inter-Regular.ttf')),
  bold: () => readFile(require.resolve('@liveworkspace/render-png/fonts/Inter-Bold.otf')),
});

// A Worker's memory is 128 MB in all; the drawing, the fetched bytes and the response take JavaScript heap beside
// resvg's, so resvg may have at most this much.
const RESVG_MEMORY_CEILING = 88 * 1024 * 1024;

// Building the pictures (one 48 MB raw bitmap deflated) and drawing them takes 4.3 s on main's CI under coverage, and
// went over vitest's 5 s default on a loaded runner (5.4 s and 5.8 s, #806 2026-10-16). The draw's time is held by
// the CPU budget below, not by this limit.
const TIMEOUT_MS = 30_000;

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

const u32 = (...values: number[]): Uint8Array => {
  const out = new Uint8Array(values.length * 4);
  values.forEach((v, i) => new DataView(out.buffer).setUint32(i * 4, v));
  return out;
};

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typed = concat([new TextEncoder().encode(type), data]);
  return concat([u32(data.length), typed, u32(crc32(typed))]);
}

// An RGB PNG: random pixels, which compress least and decode slowest, or one flat colour, the most pixels per byte.
function png(width: number, height: number, random: boolean): Uint8Array {
  const raw = new Uint8Array((width * 3 + 1) * height);
  if (random) randomFillSync(raw);
  for (let y = 0; y < height; y++) raw[y * (width * 3 + 1)] = 0;
  const ihdr = concat([u32(width, height), new Uint8Array([8, 2, 0, 0, 0])]);
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 1 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

describe('the preview picture budget', () => {
  it(
    'draws the worst page it lets through within the memory and time a Worker has',
    { timeout: TIMEOUT_MS },
    async () => {
      // Three random 800x800 pictures just under 2 MB each spend the byte budget; a flat 3000x2000 one brings the
      // pixels to 7.9 million. A flat 4000x4000 one, 16 million pixels in a few kilobytes, would pass both.
      const pictures: Record<string, Uint8Array> = {
        noise1: png(800, 800, true),
        noise2: png(800, 800, true),
        noise3: png(800, 800, true),
        flat: png(3000, 2000, false),
        bomb: png(4000, 4000, false),
      };
      for (const id of ['noise1', 'noise2', 'noise3'])
        expect(pictures[id]!.length).toBeLessThanOrEqual(PREVIEW_IMAGE_MAX_BYTES);
      const tab: Tab = {
        id: 't',
        name: 'Screens',
        elements: Object.keys(pictures).map((id, i) => ({
          id,
          type: 'image',
          imageId: id,
          x: (i % 3) * 700,
          y: Math.floor(i / 3) * 460,
          width: 660,
          height: 440,
        })),
      };
      const leftOut: string[] = [];
      const embedded = await embedTabImages(
        tab,
        async (id) => ({ bytes: pictures[id]!.slice().buffer, contentType: 'image/png' }),
        {
          maxBytesPerImage: PREVIEW_IMAGE_MAX_BYTES,
          totalBudgetBytes: PREVIEW_IMAGE_BUDGET_BYTES,
          totalBudgetPixels: PREVIEW_IMAGE_BUDGET_PIXELS,
          onOverLimit: (id) => leftOut.push(id),
        },
      );
      expect([...embedded.keys()]).toEqual(['noise1', 'noise2', 'noise3', 'flat']);
      expect(leftOut).toEqual(['bomb']);

      const svg = renderElementsToSvg(tab, { resolveImageHref: (id) => embedded.get(id) });
      let width = 0;
      const cpuMs = await cpuMsOfAsync(async () => {
        ({ width } = await renderer.renderPng(svg, 1, PREVIEW_MAX_SIDE_PX));
      });
      expect(width).toBeLessThanOrEqual(PREVIEW_MAX_SIDE_PX);
      expect(wasmMemory!.buffer.byteLength).toBeLessThanOrEqual(RESVG_MEMORY_CEILING);
      expect(cpuMs).toBeLessThan(cpuBudgetMs(3_000));
    },
  );

  it('words the note for one picture and for several', () => {
    expect(previewLeftOutNote(1, 'design')).toMatch(/^1 picture is drawn as a placeholder/);
    expect(previewLeftOutNote(3, 'design')).toMatch(/^3 pictures are drawn as a placeholder/);
  });
});
