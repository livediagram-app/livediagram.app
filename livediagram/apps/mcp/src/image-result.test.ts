import { describe, expect, it, vi } from 'vitest';

// The rasteriser is WASM; the order of the blocks is what is under test.
const drawn: string[] = [];
vi.mock('@liveworkspace/mcp-kit/render', () => ({
  svgToPngBase64: async (svg: string) => {
    drawn.push(svg);
    return 'cG5n';
  },
}));

// Each picture's bytes: a PNG header of a full-screen retina screenshot's size (2880x1800, 5.2 megapixels).
const fetched: string[] = [];
vi.mock('./api', () => ({
  apiFetch: async (_env: unknown, _token: string, path: string) => {
    fetched.push(path);
    const b = new Uint8Array(24);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, 2880);
    new DataView(b.buffer).setUint32(20, 1800);
    return new Response(b, { headers: { 'Content-Type': 'image/png' } });
  },
  apiJson: async () => {
    throw new Error('not read');
  },
}));

const { EMPTY_TAB_NOTE, imageResult, tabFontIds, tabPreview } = await import('./image-result');

// A tab with one box on it: an empty tab answers no picture.
const DRAWN = {
  id: 't',
  name: 'T',
  elements: [{ id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60 }],
} as never;

describe('imageResult', () => {
  it('puts the structured result first, then the notes, then the preview', async () => {
    const result = await imageResult({ id: 'd' }, DRAWN, undefined, [
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
    const result = await imageResult({ id: 'd' }, DRAWN);
    expect(result.content.map((block) => block.type)).toEqual(['text', 'image']);
  });

  it('answers no picture of a tab with nothing on it, and says so after the notes', async () => {
    const result = await imageResult({ id: 'd' }, { id: 't', name: 'T', elements: [] }, undefined, [
      'a note',
    ]);
    expect(result.content).toEqual([
      { type: 'text', text: '{"id":"d"}' },
      { type: 'text', text: 'a note' },
      { type: 'text', text: EMPTY_TAB_NOTE },
    ]);
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
  it('draws pictures within the budget and says how many it left as placeholders', async () => {
    drawn.length = 0;
    fetched.length = 0;
    const picture = (id: string, x: number) => ({
      id,
      type: 'image',
      imageId: `img-${id}`,
      x,
      y: 0,
      width: 300,
      height: 200,
    });
    const tab = {
      id: 't',
      name: 'Screens',
      elements: [picture('a', 0), picture('b', 320), picture('c', 640)],
    } as never;
    const blocks = await tabPreview(tab, { env: {} as never, token: 't' });
    // One screenshot fits 8 megapixels, the second and third would pass it.
    expect(blocks).toEqual([
      {
        type: 'text',
        text: '2 pictures are drawn as a placeholder in this preview, which draws only so many pixels; the document holds them as placed, and the editor shows them.',
      },
      { type: 'image', data: 'cG5n', mimeType: 'image/png' },
    ]);
    expect(drawn[0]!.match(/data:image\/png;base64/g)).toHaveLength(1);
    expect(fetched).toEqual(['/images/img-a', '/images/img-b', '/images/img-c']);
  });

  it('adds no note when every picture is drawn', async () => {
    const tab = {
      id: 't',
      name: 'One',
      elements: [{ id: 'a', type: 'image', imageId: 'one', x: 0, y: 0, width: 30, height: 20 }],
    } as never;
    const blocks = await tabPreview(tab, { env: {} as never, token: 't' });
    expect(blocks.map((b) => b.type)).toEqual(['image']);
  });
});
