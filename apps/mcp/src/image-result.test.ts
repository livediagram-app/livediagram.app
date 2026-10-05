import { describe, expect, it, vi } from 'vitest';

// The rasteriser is WASM; the order of the blocks is what is under test.
vi.mock('./render', () => ({ svgToPngBase64: async () => 'cG5n' }));

const { imageResult } = await import('./image-result');

describe('imageResult', () => {
  it('puts the structured result first, then the notes, then the preview', async () => {
    const result = await imageResult({ id: 'd' }, { id: 't', name: 'T', elements: [] }, undefined, [
      '0 crossings · 0 behind · 0 overlaps · empty → clean',
    ]);
    expect(result.content.map((block) => block.type)).toEqual(['text', 'text', 'image']);
    expect(result.content[1]).toEqual({
      type: 'text',
      text: '0 crossings · 0 behind · 0 overlaps · empty → clean',
    });
    expect(result.structuredContent).toEqual({ id: 'd' });
  });

  it('adds no note when given none', async () => {
    const result = await imageResult({ id: 'd' }, { id: 't', name: 'T', elements: [] });
    expect(result.content.map((block) => block.type)).toEqual(['text', 'image']);
  });
});
