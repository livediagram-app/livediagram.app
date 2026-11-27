import { describe, expect, it, vi } from 'vitest';

vi.mock('./token', () => ({ workspaceToken: async () => 'tok' }));

import { everyAppLibrary, libraryHosts } from './library';

describe('the Library on liveworkspace.app', () => {
  it('offers a page only where the app keeps one, the same host each time', () => {
    expect(Object.keys(libraryHosts('livediagram')).sort()).toEqual([
      'gallery',
      'shapeLibraries',
      'walkthroughs',
    ]);
    expect(Object.keys(libraryHosts('livedesign')).sort()).toEqual(['gallery', 'walkthroughs']);
    expect(Object.keys(libraryHosts('livedocuments')).sort()).toEqual(['gallery', 'walkthroughs']);
    expect(Object.keys(libraryHosts('liveplanner'))).toEqual(['walkthroughs']);
    expect(libraryHosts('livediagram').gallery).toBe(libraryHosts('livediagram').gallery);
  });

  it("reads the app's API by the workspace token", async () => {
    const fetch = vi.fn(async () => Response.json({ images: [] }));
    vi.stubGlobal('fetch', fetch);
    await libraryHosts('livedesign').gallery!.list();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/livedesign.*\/api\/images$/);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
    vi.unstubAllGlobals();
  });

  // Work Tracker 1493: in no app the Library was only the last app's, so someone last in liveplanner had no Gallery.
  it('is every app’s in no app: the one Gallery, Shape Libraries and every app’s Walkthroughs', async () => {
    const hosts = everyAppLibrary('liveplanner');
    expect(Object.keys(hosts).sort()).toEqual(['gallery', 'shapeLibraries', 'walkthroughs']);
    // liveplanner keeps no gallery: the first app that does lends its own, the same host as in that app.
    expect(hosts.gallery).toBe(libraryHosts('livediagram').gallery);
    expect(hosts.shapeLibraries).toBe(libraryHosts('livediagram').shapeLibraries);
    expect(everyAppLibrary('liveplanner')).toBe(hosts);
    // The last app's own Gallery where it keeps one.
    expect(everyAppLibrary('livedesign').gallery).toBe(libraryHosts('livedesign').gallery);
    // Walkthroughs from every app's door, newest first.
    const fetch = vi.fn(async (url: string) =>
      Response.json({
        walkthroughs: [
          {
            id: `w-${new URL(url).hostname}`,
            item: 'i1',
            title: 'Tour',
            author: null,
            durationMs: 1,
            mediaType: 'video/webm',
            mediaBytes: 1,
            camera: false,
            createdAt: url.includes('liveplanner') ? 5 : 1,
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const list = await hosts.walkthroughs!.list();
    expect(fetch.mock.calls.length).toBeGreaterThan(1);
    expect(list[0]!.id).toMatch(/liveplanner/);
    vi.unstubAllGlobals();
  });
});
