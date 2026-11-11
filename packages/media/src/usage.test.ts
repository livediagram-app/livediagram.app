import { describe, expect, it, vi } from 'vitest';
import {
  galleryUsage,
  GALLERY_USAGE_DOCUMENTS_MAX,
  GALLERY_USAGE_LOOKUP_IDS,
  GALLERY_USAGE_LOOKUPS_AT_ONCE,
  usageUnknown,
  type UsageDocument,
} from './usage';
import type { MediaUsage } from './wire';

// The Gallery's "Used in" map: every app's documents count, because the gallery lists every app's images, and an
// image is never called unused without having been checked.

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

// `count` images, each placed in its own livedocuments document.
const spread = (count: number): MediaUsage =>
  Object.fromEntries(
    Array.from({ length: count }, (_, i) => [
      `img${i}`,
      [{ app: 'livedocuments.app' as const, document: `d${i}` }],
    ]),
  );
const everyDocument = () =>
  vi.fn(async (ids: string[]) => ids.map((id) => doc(id, 'livedocuments', id)));

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
      usage: {
        a: [
          { id: 'd1', name: 'Board', app: 'livediagram' },
          { id: 'd2', name: 'Brief', app: 'livedocuments' },
        ],
        b: [{ id: 'd3', name: 'Poster', app: 'livedesign' }],
      },
      unchecked: [],
    });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup.mock.calls[0]![0]).toEqual(['d2', 'd1', 'd3']);
  });

  it('leaves out a document the index leaves out, one `keep` refuses and an unknown app: checked, so unused', async () => {
    const usage: MediaUsage = {
      a: [
        { app: 'livedocuments.app', document: 'gone' },
        { app: 'livedocuments.app', document: 'd2' },
        { app: 'nope.app' as 'livediagram.app', document: 'd2' },
      ],
      b: [{ app: 'livediagram.app', document: 'theirs' }],
    };
    const withTheirs = async (ids: string[]) => [
      ...(await lookup(ids)),
      doc('theirs', 'livediagram', 'Not mine', { ownerId: 'user_bob' }),
    ];
    expect(
      await galleryUsage(usage, withTheirs, { keep: (d) => d.ownerId === 'user_ada' }),
    ).toEqual({ usage: { a: [{ id: 'd2', name: 'Brief', app: 'livedocuments' }] }, unchecked: [] });
  });

  it('counts a document in the Trash as a use, marked, since a restore would bring the picture back', async () => {
    const usage: MediaUsage = { a: [{ app: 'livediagram.app', document: 'binned' }] };
    const trashed = async () => [doc('binned', 'livediagram', 'Old board', { trashedAt: 5 })];
    expect(await galleryUsage(usage, trashed)).toEqual({
      usage: { a: [{ id: 'binned', name: 'Old board', app: 'livediagram', trashed: true }] },
      unchecked: [],
    });
  });

  it('marks images unchecked, not unused, when their lookup fails', async () => {
    const usage: MediaUsage = { a: [{ app: 'livediagram.app', document: 'd1' }] };
    expect(await galleryUsage(usage, () => Promise.reject(new Error('down')))).toEqual({
      usage: {},
      unchecked: ['a'],
    });
  });

  it('marks only the failed batch unchecked; an image with a named use stays used', async () => {
    const usage: MediaUsage = {
      ...spread(400),
      // Placed in a document of the failed batch and in one the index named.
      both: [
        { app: 'livedocuments.app', document: 'd399' },
        { app: 'livedocuments.app', document: 'd0' },
      ],
    };
    const firstOnly = vi.fn(async (ids: string[]) => {
      if (ids.includes('d399')) throw new Error('down');
      return ids.map((id) => doc(id, 'livedocuments', id));
    });
    const answer = await galleryUsage(usage, firstOnly);
    expect(firstOnly).toHaveBeenCalledTimes(2);
    expect(Object.keys(answer.usage)).toHaveLength(201);
    expect(answer.usage.both).toEqual([{ id: 'd0', name: 'd0', app: 'livedocuments' }]);
    expect(answer.unchecked).toHaveLength(200);
    expect(answer.unchecked).toContain('img399');
    expect(answer.unchecked).not.toContain('img0');
  });

  it("names a document only in the app its reference names: an index item is one app's", async () => {
    const usage: MediaUsage = {
      a: [
        { app: 'livediagram.app', document: 'd1' },
        { app: 'livedocuments.app', document: 'd1' },
      ],
    };
    const named = await galleryUsage(usage, lookup);
    expect(named.usage.a!.map((u) => u.app)).toEqual(['livediagram']);
  });

  it('names every one of more than 200 documents, GALLERY_USAGE_LOOKUP_IDS a request', async () => {
    const every = everyDocument();
    const answer = await galleryUsage(spread(500), every);
    expect(every.mock.calls.map(([ids]) => ids.length)).toEqual([
      GALLERY_USAGE_LOOKUP_IDS,
      GALLERY_USAGE_LOOKUP_IDS,
      100,
    ]);
    expect(Object.keys(answer.usage)).toHaveLength(500);
    expect(answer.unchecked).toEqual([]);
  });

  it('runs at most GALLERY_USAGE_LOOKUPS_AT_ONCE lookups at a time', async () => {
    let open = 0;
    let most = 0;
    const slow = vi.fn(async (ids: string[]) => {
      most = Math.max(most, ++open);
      await new Promise((r) => setTimeout(r, 1));
      open--;
      return ids.map((id) => doc(id, 'livedocuments', id));
    });
    await galleryUsage(spread(2000), slow);
    expect(slow).toHaveBeenCalledTimes(10);
    expect(most).toBe(GALLERY_USAGE_LOOKUPS_AT_ONCE);
  });

  it('orders same-named uses by app, then id; and the unknown answer checks nothing', async () => {
    const usage: MediaUsage = {
      a: [
        { app: 'livedocuments.app', document: 'y' },
        { app: 'livedocuments.app', document: 'x' },
        { app: 'livediagram.app', document: 'z' },
      ],
    };
    const same = async (ids: string[]) =>
      ids.map((id) => doc(id, id === 'z' ? 'livediagram' : 'livedocuments', 'Same'));
    expect((await galleryUsage(usage, same)).usage.a!.map((u) => u.id)).toEqual(['z', 'x', 'y']);
    expect(usageUnknown()).toEqual({ usage: {}, unchecked: [], unknown: true });
  });

  it('marks the images past the bound unchecked, never unused', async () => {
    const every = everyDocument();
    const answer = await galleryUsage(spread(450), every, { max: 400 });
    expect(Object.keys(answer.usage)).toHaveLength(400);
    expect(answer.unchecked).toHaveLength(50);
    expect(answer.unchecked[0]).toBe('img400');
    // The default bound: 5,000 documents, 25 requests.
    every.mockClear();
    const full = await galleryUsage(spread(GALLERY_USAGE_DOCUMENTS_MAX + 1), every);
    expect(every).toHaveBeenCalledTimes(25);
    expect(full.unchecked).toEqual([`img${GALLERY_USAGE_DOCUMENTS_MAX}`]);
  });
});
