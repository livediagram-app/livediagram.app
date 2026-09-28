import { describe, expect, it, vi } from 'vitest';
import type { Element, ImageElement } from '@livediagram/diagram';
import type { ImportImageRequest } from '@/lib/import-images';
import { attachDrawioImages } from './images';

const image = (id: string): ImageElement => ({
  id,
  type: 'image',
  imageId: null,
  x: 0,
  y: 0,
  width: 10,
  height: 10,
});
const box = (id: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
});
const request = (elementId: string, key: string): ImportImageRequest => ({
  elementId,
  key,
  source: { kind: 'data-url', dataUrl: 'data:image/png;base64,AA==' },
  hint: { width: 10, height: 10 },
});

describe('attachDrawioImages', () => {
  it('stores every page’s images in ONE pipeline pass and hands each page back its own', async () => {
    const pages = [
      { tabId: 't1', name: 'A', elements: [box('a1'), image('i1')] },
      { tabId: 't2', name: 'B', elements: [image('i2')] },
      { tabId: 't3', name: 'C', elements: [] },
    ];
    const attach = vi.fn(async (elements: Element[], requests: ImportImageRequest[]) => ({
      elements: elements.map((el) =>
        el.type === 'image' && requests.some((r) => r.elementId === el.id)
          ? { ...el, imageId: `stored-${el.id}` }
          : el,
      ),
      report: { imported: 2, deduped: 0, placeholders: {} },
    }));
    const requests = [request('i1', 'k1'), request('i2', 'k1')];
    const out = await attachDrawioImages(pages, requests, attach);
    expect(attach).toHaveBeenCalledOnce();
    expect(attach.mock.calls[0]![0].map((e) => e.id)).toEqual(['a1', 'i1', 'i2']);
    expect(attach.mock.calls[0]![1]).toBe(requests);
    expect(
      out.pages.map((p) => p.elements.map((e) => ('imageId' in e ? e.imageId : e.id))),
    ).toEqual([['a1', 'stored-i1'], ['stored-i2'], []]);
    expect(out.pages.map((p) => p.name)).toEqual(['A', 'B', 'C']);
    expect(out.images).toEqual({ imported: 2, deduped: 0, placeholders: {} });
  });

  it('does not start the pipeline when the file has no embedded images', async () => {
    const pages = [{ tabId: 't1', name: 'A', elements: [box('a1')] }];
    const attach = vi.fn();
    expect(await attachDrawioImages(pages, [], attach)).toEqual({ pages, images: undefined });
    expect(attach).not.toHaveBeenCalled();
  });
});
