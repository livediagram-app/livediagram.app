import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { createPngRenderer, statedSize, type PngLoaders } from './index';

// docs/specs/015-api/blueprints/cli.md "render-png": one wasm initialisation, Inter for every font, PNG out.

// Counts resvg's parses: each `new Resvg` parses the whole SVG.
const parses = vi.hoisted(() => ({ count: 0 }));
vi.mock('@resvg/resvg-wasm', async (importOriginal) => {
  const real = await importOriginal<typeof import('@resvg/resvg-wasm')>();
  class Resvg extends real.Resvg {
    constructor(...args: ConstructorParameters<typeof real.Resvg>) {
      parses.count++;
      super(...args);
    }
  }
  return { ...real, Resvg };
});

const require = createRequire(import.meta.url);
const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
const fontPath = new URL('../fonts/Inter-Regular.ttf', import.meta.url);
const boldPath = new URL('../fonts/Inter-Bold.otf', import.meta.url);

const loaders = (): PngLoaders => ({
  wasm: vi.fn(() => readFile(wasmPath)),
  font: vi.fn(async () => new Uint8Array(await readFile(fontPath))),
  bold: vi.fn(async () => new Uint8Array(await readFile(boldPath))),
});

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const svg = (text: string, weight = 400) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="#fff"/><text x="10" y="50" font-family="Comic Sans MS" font-size="32" font-weight="${weight}">${text}</text></svg>`;

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

  it('retries a font load that failed', async () => {
    const l = loaders();
    vi.mocked(l.bold).mockRejectedValueOnce(new Error('disk'));
    const renderer = createPngRenderer(l);
    await expect(renderer.renderPng(svg('Hello'))).rejects.toThrow('disk');
    const { png } = await renderer.renderPng(svg('Hello'));
    expect([...png.slice(0, 4)]).toEqual(PNG_SIGNATURE);
    expect(l.font).toHaveBeenCalledTimes(2);
  });

  it('draws text in Inter whatever family it asks for, reading the font once', async () => {
    const l = loaders();
    const renderer = createPngRenderer(l);
    const empty = await renderer.renderPng(svg(''));
    const written = await renderer.renderPng(svg('Hello there'));
    // The same white image with glyphs on it encodes larger than without.
    expect(written.png.length).toBeGreaterThan(empty.png.length + 200);
    expect(l.font).toHaveBeenCalledTimes(1);
    expect(l.bold).toHaveBeenCalledTimes(1);
  });

  it('draws a weight past 500 in Inter Bold, not Regular', async () => {
    const renderer = createPngRenderer(loaders());
    const regular = await renderer.renderPng(svg('Total'));
    const bold = await renderer.renderPng(svg('Total', 700));
    const semibold = await renderer.renderPng(svg('Total', 600));
    expect(Buffer.from(bold.png).equals(Buffer.from(regular.png))).toBe(false);
    expect(Buffer.from(semibold.png).equals(Buffer.from(bold.png))).toBe(true);
  });

  it('scales, and initialises the wasm once however many renderers ask', async () => {
    await createPngRenderer(loaders()).renderPng(svg('x'));
    const other = loaders();
    const { width, height } = await createPngRenderer(other).renderPng(svg('x'), 2);
    expect([width, height]).toEqual([400, 160]);
    expect(other.wasm).not.toHaveBeenCalled();
  });
});

describe('fonts for one render', () => {
  it('takes faces beyond its own for a render, Inter drawing whatever they lack', async () => {
    const renderer = createPngRenderer(loaders());
    const extra = new Uint8Array(await readFile(boldPath));
    const plain = await renderer.renderPng(svg('Total'));
    const withExtra = await renderer.renderPng(svg('Total'), 1, undefined, [extra]);
    expect(withExtra).toMatchObject({ width: plain.width, height: plain.height });
  });
});

describe('a bound on the longer side', () => {
  const big = `<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="2000"><rect width="8000" height="2000" fill="#fff"/></svg>`;

  it('draws a drawing past it smaller, keeping its proportions, and one inside it as it is', async () => {
    const renderer = createPngRenderer(loaders());
    expect(await renderer.renderPng(big, 1, 2048)).toMatchObject({ width: 2048, height: 512 });
    expect(await renderer.renderPng(big, 0.5, 2048)).toMatchObject({ width: 2048, height: 512 });
    expect(await renderer.renderPng(svg('x'), 2, 2048)).toMatchObject({ width: 400, height: 160 });
  });
});

describe('the size a root tag states', () => {
  it('reads plain widths and heights, in any order, as resvg holds them', () => {
    expect(statedSize('<svg width="200" height="80"/>')).toEqual({ width: 200, height: 80 });
    expect(
      statedSize(
        `<?xml version="1.0"?>\n<!-- a drawing --><!DOCTYPE svg>\n<svg viewBox="0 0 1 1" height='12.5' xmlns="http://www.w3.org/2000/svg" width=".5">`,
      ),
    ).toEqual({ width: 0.5, height: 12.5 });
    expect(statedSize('<svg width="1234.567" height="3">')?.width).toBe(Math.fround(1234.567));
    expect(
      statedSize(
        `<?xml?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"><!-- one -->\t<!-- two --><svg\twidth = "7." height="8">`,
      ),
    ).toEqual({ width: 7, height: 8 });
  });

  it('leaves to resvg any size it would read another way', () => {
    for (const svg of [
      '<svg width="200px" height="80"/>',
      '<svg width="100%" height="80"/>',
      '<svg width="200"/>',
      '<svg width="0" height="80"/>',
      '<svg width="1e3" height="80"/>',
      '<svg width="200" height="80" style="width: 10px"/>',
      '<svg stroke-width="2" height="80"/>',
      '<g><svg width="200" height="80"/></g>',
      '<svgx width="200" height="80"/>',
      `${' '.repeat(5000)}<svg width="200" height="80"/>`,
      'no svg',
      '<!-- open<svg width="200" height="80"/>',
      '<?xml version="1.0"<svg width="200" height="80"/>',
      '<?xml version="1.0"><svg width="200" height="80"/>',
      '<?xml><svg width="200" height="80"/>',
      '<!-- x --><?xml?><svg width="200" height="80"/>',
      '<!DOCTYPE svg [<!ENTITY w "200">]><svg width="200" height="80"/>',
      '<!DOCTYPE svg<svg width="200" height="80"/>',
      '<!DOCTYPE a><!DOCTYPE b><svg width="200" height="80"/>',
      'text<svg width="200" height="80"/>',
      '<svg width=200 height="80"/>',
      '<svg disabled width="200" height="80"/>',
      '<svg width="200" height="80',
      '<svg width="200"height="80"/>',
    ])
      expect(statedSize(svg), svg).toBeNull();
  });

  // The worst cases for the patterns this replaced: exponential on `--><!--`, polynomial on tabs and zeros.
  it('reads hostile prologues and attributes in one pass', () => {
    const started = process.cpuUsage();
    for (const svg of [
      `<!--${'--><!--'.repeat(600)}<svg width="200" height="80"/>`,
      `<svg${'\t'.repeat(100_000)}`,
      `<svg width="0${'00'.repeat(100_000)}x" height="80"/>`,
    ])
      expect(statedSize(svg), svg).toBeNull();
    const { user, system } = process.cpuUsage(started);
    expect((user + system) / 1000).toBeLessThan(500);
  });
});

describe('one parse for a drawing past the bound', () => {
  // A drawing whose size is not a round number of pixels and whose zoom is not a round number either.
  const odd = (width: string, height: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fbfaf7"/>${Array.from(
      { length: 40 },
      (_, i) =>
        `<g><rect x="${i * 151.3}" y="${(i % 7) * 97.1}" width="118" height="118" rx="7" fill="#f0f9ff" stroke="#0ea5e9" stroke-width="2"/><text x="${i * 151.3 + 59}" y="${(i % 7) * 97.1 + 60}" font-size="22">Node ${i}</text></g>`,
    ).join('')}</svg>`;

  // Six renders of a wide drawing: room for a busy machine.
  it('draws the same bytes as parsing twice did, parsing once', { timeout: 60_000 }, async () => {
    const renderer = createPngRenderer(loaders());
    for (const [w, h] of [
      ['6053.3', '711.7'],
      ['5000', '3001'],
      ['2049', '17'],
    ] as const) {
      const stated = odd(w, h);
      // The same drawing with its size in px: resvg reads it the same, and the size is left to the double parse.
      const unstated = odd(`${w}px`, `${h}px`);
      expect(statedSize(unstated)).toBeNull();
      parses.count = 0;
      const once = await renderer.renderPng(stated, 1, 2048);
      expect(parses.count).toBe(1);
      parses.count = 0;
      const twice = await renderer.renderPng(unstated, 1, 2048);
      expect(parses.count).toBe(2);
      expect(Buffer.from(once.png).equals(Buffer.from(twice.png)), `${w}x${h}`).toBe(true);
      expect([once.width, once.height]).toEqual([twice.width, twice.height]);
    }
  });

  it('parses once, at its scale, a stated drawing inside the bound', async () => {
    const renderer = createPngRenderer(loaders());
    parses.count = 0;
    expect(await renderer.renderPng(odd('300', '200'), 2, 2048)).toMatchObject({
      width: 600,
      height: 400,
    });
    expect(parses.count).toBe(1);
  });
});
