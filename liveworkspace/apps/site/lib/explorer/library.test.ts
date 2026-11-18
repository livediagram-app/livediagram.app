import { describe, expect, it, vi } from 'vitest';

vi.mock('./token', () => ({ workspaceToken: async () => 'tok' }));

import { libraryHosts } from './library';

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
});
