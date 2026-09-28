import { describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/diagram';
import { attachImportImages } from './attach';
import type {
  ImportImageOutcome,
  ImportImageRequest,
  ImportImageSession,
  ImportImageSource,
} from './types';

const img = (id: string): Element => ({
  id,
  type: 'image',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  imageId: null,
});
const src = (tag: string): ImportImageSource => ({
  kind: 'data-url',
  dataUrl: `data:image/png;base64,${tag}`,
});

function sessionReturning(byTag: Record<string, ImportImageOutcome>) {
  const store = vi.fn(async (source: ImportImageSource) => {
    const tag = source.kind === 'data-url' ? source.dataUrl.split(',')[1]! : '';
    return byTag[tag]!;
  });
  return { session: { store } as ImportImageSession, store };
}

const stored = (
  imageId: string,
  kind: 'uploaded' | 'deduped' | 'embedded',
): ImportImageOutcome => ({
  ok: true,
  imageId,
  width: 640,
  height: 480,
  kind,
});

describe('attachImportImages', () => {
  it('fills stored images and leaves failures as placeholders', async () => {
    const elements = [
      img('a'),
      img('b'),
      { ...img('c'), type: 'shape', shape: 'square' } as Element,
    ];
    const { session } = sessionReturning({
      A: stored('id-a', 'uploaded'),
      B: { ok: false, failure: 'gallery-full' },
    });
    const requests: ImportImageRequest[] = [
      { elementId: 'a', key: 'fa', source: src('A') },
      { elementId: 'b', key: 'fb', source: src('B') },
    ];
    const { elements: out, report } = await attachImportImages(elements, requests, session);
    expect(out[0]).toMatchObject({ imageId: 'id-a', naturalWidth: 640, naturalHeight: 480 });
    expect(out[1]).toBe(elements[1]);
    expect(out[2]).toBe(elements[2]);
    expect(report).toEqual({ imported: 1, deduped: 0, placeholders: { 'gallery-full': 1 } });
  });

  it('stores a key once and gives every element sharing it the same outcome', async () => {
    const { session, store } = sessionReturning({ A: stored('id-a', 'deduped') });
    const requests: ImportImageRequest[] = [
      { elementId: 'a', key: 'f', source: src('A') },
      { elementId: 'b', key: 'f', source: src('A') },
    ];
    const { elements, report } = await attachImportImages([img('a'), img('b')], requests, session);
    expect(store).toHaveBeenCalledTimes(1);
    expect(elements.map((e) => (e.type === 'image' ? e.imageId : null))).toEqual(['id-a', 'id-a']);
    expect(report).toEqual({ imported: 0, deduped: 2, placeholders: {} });
  });

  it('counts a missing source as missing-bytes without calling the session', async () => {
    const { session, store } = sessionReturning({});
    const { report } = await attachImportImages(
      [img('a')],
      [{ elementId: 'a', key: 'f', source: null }],
      session,
    );
    expect(store).not.toHaveBeenCalled();
    expect(report).toEqual({ imported: 0, deduped: 0, placeholders: { 'missing-bytes': 1 } });
  });

  it('counts embedded images as imported', async () => {
    const { session } = sessionReturning({ A: stored('data:image/webp;base64,x', 'embedded') });
    const { report } = await attachImportImages(
      [img('a')],
      [{ elementId: 'a', key: 'f', source: src('A') }],
      session,
    );
    expect(report.imported).toBe(1);
  });

  it('reports progress per distinct image', async () => {
    const { session } = sessionReturning({
      A: stored('1', 'uploaded'),
      B: stored('2', 'uploaded'),
    });
    const progress = vi.fn();
    await attachImportImages(
      [img('a'), img('b'), img('c')],
      [
        { elementId: 'a', key: 'fa', source: src('A') },
        { elementId: 'b', key: 'fa', source: src('A') },
        { elementId: 'c', key: 'fb', source: src('B') },
      ],
      session,
      progress,
    );
    expect(progress.mock.calls.map(([p]) => p)).toEqual([
      { done: 0, total: 2 },
      { done: 1, total: 2 },
      { done: 2, total: 2 },
    ]);
  });

  it('does nothing for no requests', async () => {
    const { session } = sessionReturning({});
    const progress = vi.fn();
    const elements = [img('a')];
    const out = await attachImportImages(elements, [], session, progress);
    expect(out.elements).toBe(elements);
    expect(out.report).toEqual({ imported: 0, deduped: 0, placeholders: {} });
    expect(progress).not.toHaveBeenCalled();
  });

  it('counts a request whose element is absent without patching anything', async () => {
    const { session } = sessionReturning({ A: stored('1', 'uploaded') });
    const elements = [img('a')];
    const out = await attachImportImages(
      elements,
      [{ elementId: 'zz', key: 'f', source: src('A') }],
      session,
    );
    expect(out.elements[0]).toBe(elements[0]);
    expect(out.report.imported).toBe(1);
  });
});
