import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_IMAGE_BYTES } from '@liveworkspace/api-schema/image-limits';
import {
  appLibraryHosts,
  everyAppLibraryHosts,
  mergedWalkthroughsHost,
  uploadRefusal,
} from './http';
import type { WalkthroughEntry, WalkthroughsHost } from './types';

const token = async () => 'tok';
const libraryHosts = (app: Parameters<typeof appLibraryHosts>[0]) =>
  appLibraryHosts(app, { token });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe("the Library's hosts over an app's API", () => {
  it('offers a page only where the app keeps one, the same host each time', () => {
    expect(Object.keys(libraryHosts('livediagram')).sort()).toEqual([
      'gallery',
      'shapeLibraries',
      'walkthroughs',
    ]);
    expect(Object.keys(libraryHosts('livedesign')).sort()).toEqual(['gallery', 'walkthroughs']);
    expect(Object.keys(libraryHosts('liveplanner'))).toEqual(['walkthroughs']);
    expect(libraryHosts('livehuddle').walkthroughs).toBeUndefined();
    expect(libraryHosts('livediagram').gallery).toBe(libraryHosts('livediagram').gallery);
  });

  it("reads the gallery from the app's API by the workspace token, with each image's uses", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('/usage')
        ? json({ usage: { i1: [{ id: 'd1', name: 'Roadmap' }] }, library: ['i3'] })
        : json({
            images: [
              {
                id: 'i1',
                contentType: 'image/png',
                byteSize: 9,
                width: 2,
                height: 3,
                createdAt: 1,
                originalName: 'a.png',
              },
              {
                id: 'i2',
                contentType: 'image/png',
                byteSize: 9,
                width: 2,
                height: 3,
                createdAt: 2,
                source: 'mcp',
              },
              {
                id: 'i3',
                contentType: 'image/png',
                byteSize: 9,
                width: 2,
                height: 3,
                createdAt: 3,
                source: 'cli',
              },
            ],
          }),
    );
    vi.stubGlobal('fetch', fetch);
    const gallery = libraryHosts('livediagram').gallery!;
    expect(await gallery.list()).toEqual([
      {
        id: 'i1',
        name: 'a.png',
        contentType: 'image/png',
        byteSize: 9,
        width: 2,
        height: 3,
        createdAt: 1,
      },
      // The MCP's upload is Made by AI; the CLI's is not, as with a document's source.
      expect.objectContaining({ id: 'i2', madeByAi: true }),
      expect.not.objectContaining({ madeByAi: true }),
    ]);
    const usage = await gallery.usage!();
    expect(usage.uses.i1![0]).toMatchObject({ id: 'd1', title: 'Roadmap' });
    expect(usage.uses.i1![0]!.href).toMatch(/\/document\/d1$/);
    expect([...usage.library!]).toEqual(['i3']);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/livediagram.*\/api\/images$/);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
  });

  it("names another app's uses by their app, opening on that app's site", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          usage: {
            i1: [
              { id: 'c1', name: 'Board', app: 'livediagram' },
              { id: 'd1', name: 'Brief', app: 'livedocuments' },
            ],
          },
        }),
      ),
    );
    const usage = await libraryHosts('livediagram').gallery!.usage!();
    const [own, other] = usage.uses.i1!;
    expect(own).toMatchObject({ id: 'c1', title: 'Board' });
    expect(own!.app).toBeUndefined();
    expect(other).toMatchObject({ id: 'd1', title: 'Brief', app: 'livedocuments' });
    expect(other!.href).toMatch(/livedocuments.*\/document\/d1$/);
  });

  it('carries the images that could not be checked, and marks a Trash use without a link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          usage: {
            i1: [{ id: 'c1', name: 'Old', app: 'livediagram', trashed: true }],
            i2: [{ id: 'd1', name: 'Brief', app: 'livedocuments', trashed: true }],
          },
          unchecked: ['i3'],
        }),
      ),
    );
    const usage = await libraryHosts('livediagram').gallery!.usage!();
    expect(usage.uses.i1).toEqual([{ id: 'c1', title: 'Old', trashed: true }]);
    expect(usage.uses.i2).toEqual([
      { id: 'd1', title: 'Brief', app: 'livedocuments', trashed: true },
    ]);
    expect(usage.unchecked).toEqual(new Set(['i3']));
  });

  it('checks nothing when the api answers unknown or 503, and nothing is unchecked from an older api', async () => {
    const answers = [
      json({ usage: {}, unchecked: [], unknown: true }),
      json({ error: 'media_unavailable' }, 503),
      json({ usage: {} }),
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => answers.shift()!),
    );
    const gallery = libraryHosts('livediagram').gallery!;
    expect((await gallery.usage!()).unchecked).toBe('all');
    expect((await gallery.usage!()).unchecked).toBe('all');
    expect((await gallery.usage!()).unchecked).toEqual(new Set());
  });

  it('answers null when images are off, and says why an upload was refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ error: 'media_unavailable' }, 503)),
    );
    expect(await libraryHosts('livediagram').gallery!.list()).toBeNull();
    await expect(
      libraryHosts('livediagram').gallery!.upload!(
        new File(['x'], 'a.svg', { type: 'image/svg+xml' }),
      ),
    ).rejects.toThrow('That file type isn’t supported');
    expect(uploadRefusal(new Error('x'))).toBe('Upload failed.');
  });

  it('refuses a file over the cap before decoding or sending it', async () => {
    const send = vi.fn(async () => json({ image: {} }));
    vi.stubGlobal('fetch', send);
    const decode = vi.fn(async () => ({ width: 1, height: 1, close() {} }));
    vi.stubGlobal('createImageBitmap', decode);
    const big = new File(['x'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: MAX_IMAGE_BYTES + 1 });
    await expect(libraryHosts('livediagram').gallery!.upload!(big)).rejects.toThrow(
      'That image is too large. Images can be up to 10 MB.',
    );
    expect(decode).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('renames and trims shape libraries through the app, sending the shapes back whole', async () => {
    const calls: [string, RequestInit][] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push([url, init]);
        if (init.method === 'PUT' && String(init.body).includes('"name"'))
          return json({ error: 'shape_library_name_taken' }, 409);
        return json({ library: {} });
      }),
    );
    const host = libraryHosts('livediagram').shapeLibraries!;
    const library = {
      id: 'L1',
      name: 'Net',
      items: [
        { id: 's1', title: 'A', elements: [1] },
        { id: 's2', title: 'B', elements: [2] },
      ],
    };
    expect(await host.rename(library, 'Taken')).toEqual({
      ok: false,
      error: 'You already have a library with that name.',
    });
    await host.removeShape(library, library.items[0]!);
    const [url, init] = calls[1]!;
    expect(url).toMatch(/\/api\/shape-libraries\/L1$/);
    expect(JSON.parse(String(init.body))).toEqual({
      items: [{ id: 's2', title: 'B', elements: [2] }],
    });
  });

  it("reads an app's own origin when its editor gives one, as its own host", async () => {
    const fetch = vi.fn(async (_url: string) => json({ images: [] }));
    vi.stubGlobal('fetch', fetch);
    const local = appLibraryHosts('livedocuments', { token, origin: 'http://localhost:3000' });
    expect(local.gallery).not.toBe(libraryHosts('livedocuments').gallery);
    expect(appLibraryHosts('livedocuments', { token, origin: 'http://localhost:3000' })).toBe(
      local,
    );
    await local.gallery!.list();
    expect(fetch.mock.calls[0]![0]).toBe('http://localhost:3000/api/images');
    expect(local.gallery!.helpHref).toBe('http://localhost:3000/help/explorer/image-gallery/');
  });
});

// Work Tracker 1493: a page that is no one app's offers every app's Library.
describe('every app’s Library, in no app', () => {
  const entry = (id: string, createdAt: number): WalkthroughEntry => ({
    id,
    item: 'i1',
    title: id,
    author: null,
    durationMs: 1,
    mediaType: 'video/webm',
    mediaBytes: 1,
    camera: false,
    createdAt,
  });
  const door = (entries: WalkthroughEntry[] | Error, usage: unknown = null): WalkthroughsHost => ({
    list: vi.fn(async () => {
      if (entries instanceof Error) throw entries;
      return entries;
    }),
    usage: () => usage as ReturnType<NonNullable<WalkthroughsHost['usage']>>,
    media: vi.fn(async () => new Blob(['x'])),
    remove: vi.fn(async () => {}),
    share: vi.fn(async (e: WalkthroughEntry) => ({ ...e, shareCode: 'c' })),
  });

  it('lends the first gallery and shape libraries there are, the preferred app’s first', () => {
    const hosts = everyAppLibraryHosts('liveplanner', { token });
    expect(hosts.gallery).toBe(appLibraryHosts('livediagram', { token }).gallery);
    expect(hosts.shapeLibraries).toBe(appLibraryHosts('livediagram', { token }).shapeLibraries);
    expect(everyAppLibraryHosts('liveplanner', { token })).toBe(hosts);
    expect(everyAppLibraryHosts('livedesign', { token }).gallery).toBe(
      appLibraryHosts('livedesign', { token }).gallery,
    );
    // One app with walkthroughs lends its own door; none, no page.
    const other = async () => 'other';
    expect(everyAppLibraryHosts('liveplanner', { token: other, apps: ['liveplanner'] })).toEqual({
      walkthroughs: appLibraryHosts('liveplanner', { token: other }).walkthroughs,
    });
    expect(everyAppLibraryHosts('livehuddle', { token: other, apps: ['livehuddle'] })).toEqual({
      gallery: appLibraryHosts('livehuddle', { token: other }).gallery,
    });
  });

  it('lists every door’s walkthroughs newest first, each going back to its own door', async () => {
    const a = door([entry('a1', 1), entry('a2', 9)]);
    const b = door([entry('b1', 5)], { stored: 3, storedLimit: 5, maxMs: 1, owner: null });
    const merged = mergedWalkthroughsHost([a, b]);
    expect((await merged.list()).map((e) => e.id)).toEqual(['a2', 'b1', 'a1']);
    expect(merged.usage!()).toEqual({ stored: 3, storedLimit: 5, maxMs: 1, owner: null });
    await merged.remove(entry('b1', 5));
    expect(b.remove).toHaveBeenCalled();
    expect(a.remove).not.toHaveBeenCalled();
    await merged.media(entry('a1', 1));
    expect(a.media).toHaveBeenCalled();
    expect((await merged.share!(entry('b1', 5), true))?.shareCode).toBe('c');
    // An entry the list never answered goes to the first door.
    await merged.remove(entry('zz', 1));
    expect(a.remove).toHaveBeenCalledTimes(1);
  });

  it('leaves a failed door’s entries out, and fails only when every door does', async () => {
    const merged = mergedWalkthroughsHost([door(new Error('down')), door([entry('b1', 1)])]);
    expect((await merged.list()).map((e) => e.id)).toEqual(['b1']);
    expect(merged.usage!()).toBeNull();
    const down = mergedWalkthroughsHost([door(new Error('one')), door(new Error('two'))]);
    await expect(down.list()).rejects.toThrow('one');
    // A door that can't share answers null.
    const plain = door([entry('p1', 1)]);
    delete plain.share;
    delete plain.usage;
    const noShare = mergedWalkthroughsHost([plain]);
    await noShare.list();
    expect(await noShare.share!(entry('p1', 1), true)).toBeNull();
    expect(noShare.usage!()).toBeNull();
  });

  it('hears each door’s part as it arrives, a slow door holding back no other', async () => {
    let answerSlow!: (entries: WalkthroughEntry[]) => void;
    const slow: WalkthroughsHost = {
      ...door([]),
      list: () => new Promise((resolve) => (answerSlow = resolve)),
    };
    const merged = mergedWalkthroughsHost([slow, door([entry('a1', 1)]), door(new Error('down'))]);
    const parts: [string[], boolean][] = [];
    const done = merged.listParts!(undefined, (entries, last) =>
      parts.push([entries.map((e) => e.id), last]),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(parts).toEqual([[['a1'], false]]);
    // Deleted while the slow door is still answering: no later part puts it back.
    await merged.remove(entry('a1', 1));
    answerSlow([entry('s1', 5), entry('a1', 1)]);
    expect((await done).map((e) => e.id)).toEqual(['s1']);
    expect(parts.at(-1)).toEqual([['s1'], true]);
  });

  it('ends the parts when the last door to answer fails', async () => {
    let failLast!: (e: unknown) => void;
    const last: WalkthroughsHost = {
      ...door([]),
      list: () => new Promise((_, rej) => (failLast = rej)),
    };
    const merged = mergedWalkthroughsHost([door([entry('a1', 1)]), last]);
    const parts: boolean[] = [];
    const done = merged.listParts!(undefined, (_, end) => parts.push(end));
    await new Promise((r) => setTimeout(r, 0));
    failLast(new Error('late'));
    expect((await done).map((e) => e.id)).toEqual(['a1']);
    expect(parts).toEqual([false, true]);
  });
});
