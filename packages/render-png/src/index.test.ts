import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { createPngRenderer, type PngLoaders } from './index';

// docs/specs/015-api/blueprints/cli.md "render-png": one wasm initialisation, Inter for every font, PNG out.

const require = createRequire(import.meta.url);
const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
const fontPath = new URL('../fonts/Inter-Regular.ttf', import.meta.url);

const loaders = (): PngLoaders => ({
  wasm: vi.fn(() => readFile(wasmPath)),
  font: vi.fn(async () => new Uint8Array(await readFile(fontPath))),
});

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const svg = (text: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="#fff"/><text x="10" y="50" font-family="Comic Sans MS" font-size="32">${text}</text></svg>`;

// resvg initialises once per process, so the tests share it: the first one starts with nothing initialised.

describe('createPngRenderer', () => {
  it('retries a wasm load that failed, then draws an SVG as a PNG of its size', async () => {
    const l = loaders();
    vi.mocked(l.wasm).mockRejectedValueOnce(new Error('disk'));
    const renderer = createPngRenderer(l);
    await expect(renderer.renderPng(svg('Hello'))).rejects.toThrow('disk');
    const { png, width, height } = await renderer.renderPng(svg('Hello'));
    expect([...png.slice(0, 4)]).toEqual(PNG_SIGNATURE);
    expect([width, height]).toEqual([200, 80]);
    expect(l.wasm).toHaveBeenCalledTimes(2);
  });

  it('draws text in Inter whatever family it asks for, reading the font once', async () => {
    const l = loaders();
    const renderer = createPngRenderer(l);
    const empty = await renderer.renderPng(svg(''));
    const written = await renderer.renderPng(svg('Hello there'));
    // The same white image with glyphs on it encodes larger than without.
    expect(written.png.length).toBeGreaterThan(empty.png.length + 200);
    expect(l.font).toHaveBeenCalledTimes(1);
  });

  it('scales, and initialises the wasm once however many renderers ask', async () => {
    await createPngRenderer(loaders()).renderPng(svg('x'));
    const other = loaders();
    const { width, height } = await createPngRenderer(other).renderPng(svg('x'), 2);
    expect([width, height]).toEqual([400, 160]);
    expect(other.wasm).not.toHaveBeenCalled();
  });
});
