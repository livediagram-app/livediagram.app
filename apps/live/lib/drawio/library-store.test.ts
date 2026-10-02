// @vitest-environment jsdom
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { MAX_TAB_BYTES } from '@livediagram/api-schema';
import { importDrawioLibrary } from './library';
import { importShapeLibraries } from './library-store';
import { PIXEL_PNG } from './library-test-support';
import type { DrawioLibraryFile } from './files';

// docs/specs/013-workspace/blueprints/shape-libraries.md "Behaviour and state" 1: each imported
// library made into a shape library of its own, its pictures stored first, failures listed.

const compress = (xml: string) =>
  deflateRawSync(Buffer.from(encodeURIComponent(xml), 'latin1')).toString('base64');
const box = (label: string) =>
  `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="${label}" vertex="1" parent="1"><mxGeometry width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>`;

async function libraryFile(name: string, items: object[]): Promise<DrawioLibraryFile> {
  const r = await importDrawioLibrary({
    kind: 'text',
    text: `<mxlibrary>${JSON.stringify(items)}</mxlibrary>`,
  });
  if (!r.ok) throw new Error(r.error);
  return { name, ...r };
}

const store = vi.fn(async () => ({
  ok: true as const,
  imageId: 'img-1',
  width: 32,
  height: 32,
  kind: 'uploaded' as const,
}));
const createImageSession = vi.fn(async () => ({ store }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.spyOn(console, 'info').mockImplementation(() => {});

describe('importShapeLibraries', () => {
  it('makes each library its own, items with ids and titles, pictures stored first', async () => {
    const createLibrary = vi.fn(async (input: { name: string }) => ({
      ok: true as const,
      library: { id: `id-${input.name}`, name: `${input.name} (2)` },
    }));
    const files = [
      await libraryFile('Team icons', [
        { xml: compress(box('Service')), w: 120, h: 60, title: 'Service' },
        { data: PIXEL_PNG, w: 32, h: 32, title: '' },
      ]),
      await libraryFile('UML', [{ xml: compress(box('Class')), w: 120, h: 60, title: 'Class' }]),
    ];
    const progress = vi.fn();
    const r = await importShapeLibraries(files, {
      ownerId: 'o',
      createLibrary: createLibrary as never,
      createImageSession,
      onProgress: progress,
    });
    expect(r.libraries).toEqual([
      { id: 'id-Team icons', name: 'Team icons (2)' },
      { id: 'id-UML', name: 'UML (2)' },
    ]);
    expect(r.failures).toEqual([]);
    const first = createLibrary.mock.calls[0]![0] as never as {
      name: string;
      source: string;
      items: { id: string; title: string; elements: { type: string; imageId?: string }[] }[];
    };
    expect(first).toMatchObject({ name: 'Team icons', source: 'drawio' });
    expect(first.items.map((i) => i.title)).toEqual(['Service', '']);
    expect(new Set(first.items.map((i) => i.id)).size).toBe(2);
    expect(first.items[1]!.elements[0]).toMatchObject({ type: 'image', imageId: 'img-1' });
    expect(createImageSession).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 'o', documentId: null }),
    );
    expect(r.images).toMatchObject({ imported: 1 });
    // Landed totals count the items' elements: two shapes and an image.
    expect(r.scene?.landed).toEqual({ shape: 2, image: 1 });
  });

  it('lists a refused library and goes on with the next', async () => {
    const createLibrary = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'You have 100 shape libraries already.' })
      .mockResolvedValueOnce({ ok: true, library: { id: 'b', name: 'B' } });
    const files = [
      await libraryFile('A', [{ xml: compress(box('x')), w: 10, h: 10, title: 'x' }]),
      await libraryFile('B', [{ xml: compress(box('y')), w: 10, h: 10, title: 'y' }]),
    ];
    const r = await importShapeLibraries(files, {
      ownerId: 'o',
      createLibrary,
      createImageSession,
    });
    expect(r.failures).toEqual([{ title: 'A', message: 'You have 100 shape libraries already.' }]);
    expect(r.libraries).toEqual([{ id: 'b', name: 'B' }]);
  });

  it('does not send a library over the row budget', async () => {
    const createLibrary = vi.fn();
    const file = await libraryFile('Huge', [
      { xml: compress(box('x'.repeat(10))), w: 10, h: 10, title: 'x' },
    ]);
    file.items[0]!.title = 'x';
    file.items[0]!.elements = [
      { ...file.items[0]!.elements[0]!, label: 'y'.repeat(MAX_TAB_BYTES) } as never,
    ];
    const r = await importShapeLibraries([file], {
      ownerId: 'o',
      createLibrary,
      createImageSession,
    });
    expect(createLibrary).not.toHaveBeenCalled();
    expect(r.failures).toEqual([{ title: 'Huge', message: 'This library is too large to store.' }]);
  });
});
