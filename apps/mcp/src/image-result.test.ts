import { describe, expect, it, vi } from 'vitest';

// The rasteriser is WASM; the order of the blocks is what is under test.
const drawn: string[] = [];
vi.mock('./render', () => ({
  svgToPngBase64: async (svg: string) => {
    drawn.push(svg);
    return 'cG5n';
  },
}));

// Any fetch the preview makes: none, since liveplanner keeps no uploaded pictures.
const fetched: string[] = [];
vi.mock('./api', () => ({
  apiFetch: async (_env: unknown, _token: string, path: string) => {
    fetched.push(path);
    return new Response(null, { status: 404 });
  },
  apiJson: async () => {
    throw new Error('not read');
  },
}));

const { imageResult, tabFontIds, tabPreview } = await import('./image-result');

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

describe('tabFontIds', () => {
  it("asks for Inter's italics only when some text is italic, its own or a run's", () => {
    const tab = (elements: unknown[]) => ({ id: 't', name: 'T', elements }) as never;
    const text = { id: 'a', type: 'text', x: 0, y: 0, width: 10, height: 10, label: 'x' };
    expect(tabFontIds(tab([text]))).not.toContain('inter-italic');
    expect(tabFontIds(tab([{ ...text, textItalic: true }]))).toContain('inter-italic');
    expect(tabFontIds(tab([{ ...text, runs: [{ text: 'x', italic: true }] }]))).toContain(
      'inter-italic',
    );
  });
});

describe('tabPreview', () => {
  it('draws a Pages tab as its pages, its content and faces fetched together', async () => {
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
      opensIn: 'pages',
      pages: [{ id: 'p1', orientation: 'landscape', kind: 'slide', size: 'slide' }],
    } as never;
    const blocks = await tabPreview(tab);
    expect(blocks).toMatchObject([{ type: 'image', mimeType: 'image/png' }]);
    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toMatch(/^<svg /);
  });

  it('draws an image element as its placeholder and fetches no picture', async () => {
    drawn.length = 0;
    fetched.length = 0;
    const tab = {
      id: 't',
      name: 'One',
      elements: [{ id: 'a', type: 'image', imageId: 'one', x: 0, y: 0, width: 30, height: 20 }],
    } as never;
    const blocks = await tabPreview(tab, { env: {} as never, token: 't' });
    expect(blocks).toEqual([{ type: 'image', data: 'cG5n', mimeType: 'image/png' }]);
    expect(drawn[0]).not.toMatch(/data:image\/png;base64/);
    expect(fetched).toEqual([]);
  });
});
