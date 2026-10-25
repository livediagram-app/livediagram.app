import { afterEach, describe, expect, it, vi } from 'vitest';

import { appLibraryHosts, uploadRefusal } from './http';

const token = async () => 'tok';
const libraryHosts = (app: Parameters<typeof appLibraryHosts>[0]) =>
  appLibraryHosts(app, { token });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe("the Library's hosts over an app's API", () => {
  it('offers a page only where the app keeps one, the same host each time', () => {
    expect(Object.keys(libraryHosts('livediagram')).sort()).toEqual(['gallery', 'shapeLibraries']);
    expect(Object.keys(libraryHosts('livedesign'))).toEqual(['gallery']);
    expect(libraryHosts('liveplanner')).toEqual({});
    expect(libraryHosts('livediagram').gallery).toBe(libraryHosts('livediagram').gallery);
  });

  it("reads the gallery from the app's API by the workspace token, with each image's uses", async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('/usage')
        ? json({ usage: { i1: [{ id: 'd1', name: 'Roadmap' }] } })
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
    ]);
    const usage = await gallery.usage!();
    expect(usage.i1![0]).toMatchObject({ id: 'd1', title: 'Roadmap' });
    expect(usage.i1![0]!.href).toMatch(/\/document\/d1$/);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/livediagram.*\/api\/images$/);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
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
