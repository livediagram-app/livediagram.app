import { describe, expect, it, vi } from 'vitest';
import type { Item, ShareLink } from '@liveworkspace/index-client';

vi.mock('./token', () => ({ workspaceToken: async () => 'tok' }));

import { communityShareOf, handOverFor, loadTabsOf, shareHelpHrefFor, shareHostFor } from './share';

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

  it('reads a design’s tabs alone from livedesign too', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ tabs: [{ id: 't1', name: 'Logo', kind: 'pages' }] }),
    );
    const tabs = await loadTabsOf({ app: 'livedesign', id: 'd1', sharedVia: null }, fetch);
    expect(tabs).toEqual([{ id: 't1', name: 'Logo' }]);
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toMatch(/\/api\/designs\/d1\/tabs$/);
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

describe('the Community tab on liveworkspace.app', () => {
  const account = { id: 'user_a', name: 'Ada' };
  const canvas = {
    app: 'livediagram' as Item['app'],
    id: 'd 1',
    title: 'Payments',
    ownerId: 'user_a',
  };

  it('offers the account’s own canvases, through livediagram’s owner route with the workspace token', async () => {
    const fetch = vi.fn(async () => Response.json({ post: null }));
    const tab = communityShareOf(canvas, account, true, '/sign-in', fetch)!;
    expect(tab).toMatchObject({
      ownerId: 'user_a',
      documentName: 'Payments',
      signedIn: true,
      communityOn: true,
      signInHref: '/sign-in',
      author: { name: 'Ada' },
    });
    expect(tab.host.app).toBe('livediagram.app');
    expect(tab.host.words.noun).toBe('canvas');
    expect(tab.host.postHref('p1')).toBe('https://www.livediagram.app/community/post/?id=p1');
    expect(await tab.host.client.get()).toBeNull();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://www.livediagram.app/api/documents/d%201/community');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
  });

  it('offers none for someone else’s item, a guest, an app with no Community yet, or while it is off', () => {
    expect(communityShareOf({ ...canvas, ownerId: 'user_b' }, account, true, '')).toBeUndefined();
    expect(communityShareOf(canvas, null, true, '')).toBeUndefined();
    expect(communityShareOf(canvas, account, false, '')).toBeUndefined();
    expect(communityShareOf({ ...canvas, app: 'liveplanner' }, account, true, '')).toBeUndefined();
    expect(
      communityShareOf({ ...canvas, app: 'nope' as never }, account, true, ''),
    ).toBeUndefined();
  });

  it('is the Share host’s, per item', () => {
    const host = shareHostFor('livediagram', account, true, '/sign-in');
    expect(host.community!(canvas as never)?.documentName).toBe('Payments');
    expect(shareHostFor('livediagram').community!(canvas as never)).toBeUndefined();
  });
});
