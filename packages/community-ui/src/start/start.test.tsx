import type { CommunityStartPost } from '@liveworkspace/community';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCommunityEnabledForTests } from '../tile/useCommunityEnabled';
import {
  COMMUNITY_START_BADGE,
  CommunityStartPicture,
  communityStartCard,
  communityStartCardId,
  communityStartCredit,
  communityStartHref,
  communityStartInHand,
  communityStartMatches,
  communityStartPostId,
  communityStartPostsIn,
  fetchCommunityStart,
  findCommunityStartPost,
  resetCommunityStartForTests,
  useCommunityStart,
} from './index';

// Start With's Community tiles (liveworkspace/docs/specs/007-community/community.md "Start With"): one read per
// session, asked when a picker opens, silent on every failure, and the cards a picker draws from it.

const tile = (patch: Partial<CommunityStartPost> = {}): CommunityStartPost => ({
  id: 'p1',
  app: 'livediagram.app',
  title: 'Sprint Retro, Remote',
  category: 'retros',
  shareCode: 'CODE1',
  likeCount: 12,
  copyCount: 3,
  anonymous: false,
  authorName: 'Ada',
  line: 'What went well.',
  ...patch,
});

const SOURCE = {
  app: 'livediagram.app',
  communityApi: 'http://localhost:8791/api/community',
} as const;
const START_URL = 'http://localhost:8791/api/community/start?app=livediagram.app';

let start: () => Response | Promise<Response>;
let capabilities: () => Response | Promise<Response>;

beforeEach(() => {
  resetCommunityStartForTests();
  resetCommunityEnabledForTests();
  start = () => Response.json({ categories: { retros: [tile()] } });
  capabilities = () => Response.json({ communityEnabled: true });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      String(url).endsWith('/capabilities') ? capabilities() : start(),
    ),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const startCalls = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url) === START_URL);

describe('fetchCommunityStart', () => {
  it("asks the app's start read once a session, beside its capabilities", async () => {
    expect(await fetchCommunityStart(SOURCE)).toEqual({ retros: [tile()] });
    expect(await fetchCommunityStart(SOURCE)).toEqual({ retros: [tile()] });
    expect(startCalls()).toHaveLength(1);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toContain('/api/capabilities');
    expect(communityStartInHand(SOURCE)).toEqual({ retros: [tile()] });
  });

  it('is no tiles when the app or the service has switched the Community off, for the session', async () => {
    capabilities = () => Response.json({ communityEnabled: false });
    expect(await fetchCommunityStart(SOURCE)).toEqual({});
    resetCommunityEnabledForTests();
    resetCommunityStartForTests();
    capabilities = () => Response.json({ communityEnabled: true });
    start = () => new Response(null, { status: 404 });
    expect(await fetchCommunityStart(SOURCE)).toEqual({});
    expect(await fetchCommunityStart(SOURCE)).toEqual({});
    expect(startCalls()).toHaveLength(2);
  });

  it('is no tiles on a failure or nonsense, and asks again next time', async () => {
    start = () => new Response(null, { status: 503 });
    expect(await fetchCommunityStart(SOURCE)).toEqual({});
    expect(communityStartInHand(SOURCE)).toBeUndefined();
    start = () => Promise.reject(new TypeError('offline'));
    expect(await fetchCommunityStart(SOURCE)).toEqual({});
    start = () => Response.json({ categories: ['nope'] });
    expect(await fetchCommunityStart(SOURCE)).toEqual({});
    resetCommunityStartForTests();
    start = () => Response.json(null);
    expect(await fetchCommunityStart(SOURCE)).toEqual({});
    expect(startCalls()).toHaveLength(4);
  });
});

describe('useCommunityStart', () => {
  it('is empty until the answer arrives, then the tiles; a picker opened again has them at once', async () => {
    const first = renderHook(() => useCommunityStart(SOURCE));
    expect(first.result.current).toEqual({});
    await waitFor(() => expect(first.result.current).toEqual({ retros: [tile()] }));
    first.unmount();
    const again = renderHook(() => useCommunityStart(SOURCE));
    expect(again.result.current).toEqual({ retros: [tile()] });
    expect(startCalls()).toHaveLength(1);
  });

  it('asks nothing when told not to', async () => {
    const { result } = renderHook(() => useCommunityStart(SOURCE, false));
    await act(async () => {});
    expect(result.current).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops an answer that lands after the picker closed', async () => {
    let answer!: (res: Response) => void;
    start = () => new Promise((resolve) => (answer = resolve));
    const { result, unmount } = renderHook(() => useCommunityStart(SOURCE));
    unmount();
    await act(async () => answer(Response.json({ categories: { retros: [tile()] } })));
    expect(result.current).toEqual({});
  });
});

describe('the cards', () => {
  it('names a tile by its post, apart from any template kind', () => {
    expect(communityStartCardId('p1')).toBe('community:p1');
    expect(communityStartPostId('community:p1')).toBe('p1');
    expect(communityStartPostId('community:')).toBeNull();
    expect(communityStartPostId('retrospective')).toBeNull();
  });

  it('opens a copy through the community link, on the post’s own app', () => {
    expect(communityStartHref(tile())).toBe('/document/shared?s=CODE1&copy=1');
    expect(communityStartHref(tile({ app: 'livedesign.app' }))).toBe(
      '/design/shared?s=CODE1&copy=1',
    );
    expect(communityStartHref(tile({ app: 'liveplanner.app', shareCode: 'a b' }))).toBe(
      '/project/shared?s=a%20b&copy=1',
    );
  });

  it('credits the author, or says it was shared anonymously', () => {
    expect(communityStartCredit(tile())).toBe('By Ada');
    expect(communityStartCredit(tile({ anonymous: true, authorName: 'Anonymous' }))).toBe(
      'Shared anonymously',
    );
  });

  it('is badged Community, with its title, line and live image', () => {
    const card = communityStartCard(tile(), { imageUrl: (code) => `/api/share/${code}/image.svg` });
    expect(card).toMatchObject({
      id: 'community:p1',
      name: 'Sprint Retro, Remote',
      line: 'What went well.',
      badge: COMMUNITY_START_BADGE,
      ariaKind: 'from the Community',
    });
    const { container } = render(<>{card.picture}</>);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/api/share/CODE1/image.svg');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('keeps the plate and leaves the image out when it cannot load', () => {
    const { container } = render(<CommunityStartPicture src="/x.svg" className="plate" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.plate')).toBeTruthy();
  });

  it("reads a category's tiles and finds one by its card", () => {
    const posts = { retros: [tile()], ideas: 'nope' } as never;
    expect(communityStartPostsIn(posts, 'retros')).toEqual([tile()]);
    expect(communityStartPostsIn(posts, 'ideas')).toEqual([]);
    expect(communityStartPostsIn(posts, 'goals')).toEqual([]);
    expect(findCommunityStartPost(posts, 'community:p1')).toEqual(tile());
    expect(findCommunityStartPost(posts, 'community:p9')).toBeNull();
    expect(findCommunityStartPost(posts, 'kanban')).toBeNull();
  });

  it('matches a search by every word of the title, case and punctuation ignored', () => {
    expect(communityStartMatches(tile(), 'retro')).toBe(true);
    expect(communityStartMatches(tile(), 'REMOTE sprint')).toBe(true);
    expect(communityStartMatches(tile(), 'retro, remote!')).toBe(true);
    expect(communityStartMatches(tile(), 'retro kanban')).toBe(false);
    expect(communityStartMatches(tile(), '  ')).toBe(false);
  });
});
