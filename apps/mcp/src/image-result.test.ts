import { describe, expect, it, vi } from 'vitest';

// The rasteriser is WASM; the order of the blocks is what is under test.
const drawn: string[] = [];
vi.mock('./render', () => ({
  svgToPngBase64: async (svg: string) => {
    drawn.push(svg);
    return 'cG5n';
  },
}));

const { imageResult, tabPreview } = await import('./image-result');

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

describe('tabPreview', () => {
  it('draws an Illustrate tab as its pages, its content and faces fetched together', async () => {
    drawn.length = 0;
    const tab = {
      id: 't',
      name: 'Deck',
      elements: [
        {
          id: 'a',
          type: 'shape',
          shape: 'square',
          x: 40,
          y: 40,
          width: 100,
          height: 60,
          label: 'On slide',
        },
      ],
      pages: [{ id: 'p1', orientation: 'landscape', kind: 'slide', size: 'slide' }],
    } as never;
    const block = await tabPreview(tab);
    expect(block).toMatchObject({ type: 'image', mimeType: 'image/png' });
    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toMatch(/^<svg /);
  });
});
