import { describe, expect, it, vi } from 'vitest';
import type { ShareLink } from '@liveworkspace/index-client';

vi.mock('./token', () => ({ workspaceToken: async () => 'tok' }));

import { handOverFor, loadTabsOf, shareHelpHrefFor } from './share';

const link = { code: 'c/1' } as ShareLink;

describe('the Share dialog’s extras on liveworkspace.app', () => {
  it('builds each app’s embed and live image from its registry entry', () => {
    const planner = handOverFor('liveplanner')!;
    expect(planner.embedUrl!(link)).toBe('https://www.liveplanner.app/embed?s=c%2F1');
    expect(planner.liveImageUrl!(link)).toBe(
      'https://www.liveplanner.app/api/share/c%2F1/image.svg',
    );
    expect(planner.liveImageUrl!(link, 't 2')).toBe(
      'https://www.liveplanner.app/api/share/c%2F1/image.svg?tab=t%202',
    );
    expect(planner.liveImageAlt).toBe('liveplanner tab');
    expect(handOverFor('livedesign')!.embedUrl!(link)).toMatch(
      /^https:\/\/[^/]*livedesign\.app\/embed\?s=/,
    );
  });

  it('reads an item’s tabs alone, once, from its app, with the token and its share code', async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        tabs: [{ id: 't1', name: 'Board', kind: 'board' }, { id: 't2', kind: null }, { name: 'x' }],
      }),
    );
    const tabs = await loadTabsOf({ app: 'liveplanner', id: 'p 1', sharedVia: 'code' }, fetch);
    expect(tabs).toEqual([
      { id: 't1', name: 'Board' },
      { id: 't2', name: '' },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    // The tabs read (@liveworkspace/index-app tabs.ts), never the whole plan.
    expect(url).toBe('https://www.liveplanner.app/api/projects/p%201/tabs');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok');
    expect(headers.get('X-Share-Code')).toBe('code');
  });

  it('reads the whole item from an app not yet serving its tabs alone', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ document: { tabs: [{ id: 't1', name: 'Canvas' }] } }),
    );
    const tabs = await loadTabsOf({ app: 'livediagram', id: 'd1', sharedVia: null }, fetch);
    expect(tabs).toEqual([{ id: 't1', name: 'Canvas' }]);
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toMatch(/\/api\/documents\/d1$/);
  });

  it('offers no tabs when the read fails, so a pass opens every tab', async () => {
    const failing = vi.fn(async () => new Response(null, { status: 404 }));
    expect(
      await loadTabsOf({ app: 'livedesign', id: 'd', sharedVia: null }, failing as never),
    ).toEqual([]);
    const throwing = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(
      await loadTabsOf({ app: 'livedesign', id: 'd', sharedVia: null }, throwing as never),
    ).toEqual([]);
  });

  it('links the page’s app’s help on sharing', () => {
    expect(shareHelpHrefFor('liveplanner')('sharePasswords')).toBe(
      'https://www.liveplanner.app/help/collaboration/sharing/share-passwords/',
    );
  });
});
