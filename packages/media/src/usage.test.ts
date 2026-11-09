import { describe, expect, it, vi } from 'vitest';
import { galleryUsage, GALLERY_USAGE_LOOKUP_IDS, type UsageDocument } from './usage';
import type { MediaUsage } from './wire';

// The Gallery's "Used in" map: every app's documents count, because the gallery lists every app's images.

const doc = (id: string, app: string, title: string, extra: Partial<UsageDocument> = {}) => ({
  id,
  app,
  title,
  ownerId: 'user_ada',
  trashedAt: null,
  ...extra,
});

const indexed: UsageDocument[] = [
  doc('d1', 'livediagram', 'Board'),
  doc('d2', 'livedocuments', 'Brief'),
  doc('d3', 'livedesign', 'Poster'),
];
const lookup = vi.fn(async (ids: string[]) => indexed.filter((d) => ids.includes(d.id)));

describe('galleryUsage', () => {
  it("names each image's documents in every app, by name, each once, in one lookup", async () => {
    lookup.mockClear();
    const usage: MediaUsage = {
      a: [
        { app: 'livedocuments.app', document: 'd2' },
        { app: 'livediagram.app', document: 'd1' },
        { app: 'livediagram.app', document: 'd1' },
      ],
      b: [{ app: 'livedesign.app', document: 'd3' }],
    };
    expect(await galleryUsage(usage, lookup)).toEqual({
      a: [
        { id: 'd1', name: 'Board', app: 'livediagram' },
        { id: 'd2', name: 'Brief', app: 'livedocuments' },
      ],
      b: [{ id: 'd3', name: 'Poster', app: 'livedesign' }],
    });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup.mock.calls[0]![0]).toEqual(['d2', 'd1', 'd3']);
  });

  it('leaves out a document the index leaves out, one `keep` refuses, an unknown app, and an image left with none', async () => {
    const usage: MediaUsage = {
      a: [
        { app: 'livedocuments.app', document: 'gone' },
        { app: 'livedocuments.app', document: 'd2' },
        { app: 'nope.app' as 'livediagram.app', document: 'd2' },
      ],
      b: [{ app: 'livediagram.app', document: 'trashed' }],
    };
    const withTrashed = async (ids: string[]) => [
      ...(await lookup(ids)),
      doc('trashed', 'livediagram', 'Gone', { trashedAt: 5 }),
    ];
    expect(await galleryUsage(usage, withTrashed, { keep: (d) => d.trashedAt === null })).toEqual({
      a: [{ id: 'd2', name: 'Brief', app: 'livedocuments' }],
    });
  });

  it('leaves everything out when the lookup fails, rather than failing the Gallery', async () => {
    const usage: MediaUsage = { a: [{ app: 'livediagram.app', document: 'd1' }] };
    expect(await galleryUsage(usage, () => Promise.reject(new Error('down')))).toEqual({});
  });

  it("names a document only in the app its reference names: an index item is one app's", async () => {
    const usage: MediaUsage = {
      a: [
        { app: 'livediagram.app', document: 'd1' },
        { app: 'livedocuments.app', document: 'd1' },
      ],
    };
    const named = await galleryUsage(usage, lookup);
    expect(named.a!.map((u) => u.app)).toEqual(['livediagram']);
  });

  it('looks up at most `max` documents, GALLERY_USAGE_LOOKUP_IDS a request', async () => {
    const usage: MediaUsage = {
      a: Array.from({ length: 500 }, (_, i) => ({
        app: 'livedocuments.app' as const,
        document: `d${i}`,
      })),
    };
    const every = vi.fn(async (ids: string[]) => ids.map((id) => doc(id, 'livedocuments', id)));
    const named = await galleryUsage(usage, every, { max: 450 });
    expect(every.mock.calls.map(([ids]) => ids.length)).toEqual([
      GALLERY_USAGE_LOOKUP_IDS,
      GALLERY_USAGE_LOOKUP_IDS,
      50,
    ]);
    expect(named.a).toHaveLength(450);
    // The default: 200, one request.
    every.mockClear();
    expect((await galleryUsage(usage, every)).a).toHaveLength(200);
    expect(every).toHaveBeenCalledTimes(1);
  });
});
