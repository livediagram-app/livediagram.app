import { describe, expect, it, vi } from 'vitest';

// The Worker entry hands the renderer what wrangler bundles: the wasm as a compiled module and the fonts as raw
// bytes. Node cannot import those the way a Worker does, so they are stood in for here and the loaders read back.

vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({ default: 'compiled-wasm' }));
vi.mock('../fonts/Inter-Regular.ttf', () => ({ default: new Uint8Array([1, 2]).buffer }));
vi.mock('../fonts/Inter-Bold.otf', () => ({ default: new Uint8Array([3]).buffer }));
vi.mock('./index', () => ({ createPngRenderer: vi.fn((loaders: unknown) => ({ loaders })) }));

import { workerPngRenderer } from './worker';

type Loaders = {
  wasm: () => Promise<unknown>;
  font: () => Promise<Uint8Array>;
  bold: () => Promise<Uint8Array>;
};

describe('workerPngRenderer', () => {
  it('loads the bundled wasm module and both Inter faces as bytes', async () => {
    const { loaders } = workerPngRenderer as unknown as { loaders: Loaders };
    expect(await loaders.wasm()).toBe('compiled-wasm');
    expect(await loaders.font()).toEqual(new Uint8Array([1, 2]));
    expect(await loaders.bold()).toEqual(new Uint8Array([3]));
  });
});
