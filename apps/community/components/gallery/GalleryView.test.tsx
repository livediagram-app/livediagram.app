// @vitest-environment jsdom
import { communityPostFixture } from '@livediagram/api-schema/testing';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CommunityMinePost,
  CommunityMineTotals,
  CommunityPost,
} from '@livediagram/api-schema';
import type { CommunitySession } from '@/lib/session';

// The gallery end to end (docs/specs/025-community/community.md "Gallery", "My Shares"): filters live in the URL
// and the search box, the controls write their words into it, results load per filter set (a stale answer is
// dropped), Load More pages, and each empty, error and signed-out state shows its own copy.

const h = vi.hoisted(() => ({
  session: null as CommunitySession | null,
  emit: null as ((s: CommunitySession) => void) | null,
  telemetry: { selected: vi.fn(), searched: vi.fn() },
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/lib/telemetry', () => ({ communityTelemetry: h.telemetry }));
vi.mock('@/lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session')>()),
  signInAvailable: true,
}));
// Clerk itself is not loaded in tests: the lazy session reports whatever the test set.
vi.mock('../auth/LazyClerkSession', () => ({
  LazyClerkSession: ({ onSession }: { onSession: (s: CommunitySession) => void }) => {
    useEffect(() => {
      h.emit = onSession;
      if (h.session) onSession(h.session);
    }, [onSession]);
    return null;
  },
}));

import { GalleryView } from './GalleryView';

let n = 0;
function post(patch: Partial<CommunityPost> = {}): CommunityPost {
  n += 1;
  return communityPostFixture({
    id: `post${n}`,
    title: `Post ${n}`,
    description: 'A document worth sharing.',
    tags: ['aws'],
    likeCount: 2,
    copyCount: 1,
    publishedAt: Date.now() - 60_000,
    updatedAt: Date.now() - 60_000,
    shareCode: `CODE${n}`,
    ...patch,
  });
}

type Answer = Response | Promise<Response>;
const routes: {
  match: (url: string) => boolean;
  answer: (url: string, init?: RequestInit) => Answer;
}[] = [];
const calls: { url: string; init?: RequestInit }[] = [];

function route(
  match: (url: string) => boolean,
  answer: (url: string, init?: RequestInit) => Answer,
) {
  routes.unshift({ match, answer });
}

const isPosts = (url: string) => url.startsWith('/api/community/posts');
const isMine = (url: string) => url.startsWith('/api/community/mine');
const queryOf = (url: string) => new URL(url, 'https://x.test').searchParams;

beforeEach(() => {
  n = 0;
  routes.length = 0;
  calls.length = 0;
  h.session = null;
  h.telemetry.selected.mockReset();
  h.telemetry.searched.mockReset();
  window.history.replaceState(null, '', '/');
  route(
    () => true,
    () => new Response(null, { status: 404 }),
  );
  route(
    (url) => url.startsWith('/api/community/facets'),
    () =>
      Response.json({
        total: 3,
        categories: { architecture: 3 },
        tags: [{ tag: 'aws', count: 3 }],
      }),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      return routes.find((r) => r.match(url))!.answer(url, init);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const search = () => screen.getByRole('searchbox') as HTMLInputElement;
const postCalls = () => calls.filter((c) => isPosts(c.url));

describe('the gallery', () => {
  it('loads the filters in the address and shows the cards', async () => {
    window.history.replaceState(null, '', '/?q=%23aws');
    route(isPosts, () => Response.json({ posts: [post(), post()], nextOffset: null }));
    render(<GalleryView />);
    expect(await screen.findByText('Post 1')).toBeTruthy();
    expect(screen.getByText('Post 2')).toBeTruthy();
    expect(search().value).toBe('#aws');
    expect(queryOf(postCalls()[0]!.url).get('q')).toBe('#aws');
  });

  it("writes a control's word into the search and counts it as that choice, not a search", async () => {
    route(isPosts, () => Response.json({ posts: [post()], nextOffset: null }));
    render(<GalleryView />);
    await screen.findByText('Post 1');

    fireEvent.click(screen.getByRole('button', { name: 'Sort: Newest' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Most Loved/ }));

    await waitFor(() => expect(search().value).toBe('sort:loved'));
    expect(window.location.search).toContain('sort%3Aloved');
    await waitFor(() => expect(queryOf(postCalls().at(-1)!.url).get('sort')).toBe('loved'));
    expect(h.telemetry.selected).toHaveBeenCalledWith('Sort');
    expect(h.telemetry.searched).not.toHaveBeenCalled();
  });

  it('filters by category and tag from their menus', async () => {
    route(isPosts, () => Response.json({ posts: [post()], nextOffset: null }));
    render(<GalleryView />);
    await screen.findByText('Post 1');

    fireEvent.click(screen.getByRole('button', { name: 'Filter by category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Architecture/ }));
    await waitFor(() => expect(search().value).toBe('category:architecture'));

    fireEvent.click(screen.getByRole('button', { name: 'Filter by tag' }));
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: /aws/ }));
    await waitFor(() => expect(search().value).toBe('category:architecture #aws'));
    expect(h.telemetry.selected).toHaveBeenCalledWith('Category');
    expect(h.telemetry.selected).toHaveBeenCalledWith('Tag');
  });

  it('searches the typed words after the pause, and counts one search', async () => {
    route(isPosts, () => Response.json({ posts: [post()], nextOffset: null }));
    render(<GalleryView />);
    await screen.findByText('Post 1');
    fireEvent.change(search(), { target: { value: 'checkout flow' } });
    await waitFor(() => expect(queryOf(postCalls().at(-1)!.url).get('q')).toBe('checkout flow'));
    expect(h.telemetry.searched).toHaveBeenCalledTimes(1);
  });

  it('never rewrites what is being typed when the address catches up', async () => {
    route(isPosts, () => Response.json({ posts: [post()], nextOffset: null }));
    render(<GalleryView />);
    await screen.findByText('Post 1');
    fireEvent.change(search(), { target: { value: 'cloud ' } });
    await waitFor(() => expect(window.location.search).toBe('?q=cloud'));
    expect(search().value).toBe('cloud ');
    fireEvent.change(search(), { target: { value: 'cloud sort:' } });
    await new Promise((r) => setTimeout(r, 400));
    expect(search().value).toBe('cloud sort:');
  });

  it('takes a change made elsewhere', async () => {
    route(isPosts, () => Response.json({ posts: [post()], nextOffset: null }));
    render(<GalleryView />);
    await screen.findByText('Post 1');
    act(() => {
      window.history.replaceState(null, '', '/?q=%23aws');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(search().value).toBe('#aws'));
  });

  it('clears what was searched for, keeping the sort', async () => {
    window.history.replaceState(null, '', '/?q=retro%20%23aws%20sort%3Aloved');
    route(isPosts, () => Response.json({ posts: [post()], nextOffset: null }));
    render(<GalleryView />);
    await screen.findByText('Post 1');
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));
    await waitFor(() => expect(search().value).toBe('sort:loved'));
  });

  it('drops a slow answer for filters that are no longer shown', async () => {
    let releaseFirst: (r: Response) => void = () => {};
    route(isPosts, (url) =>
      queryOf(url).get('q') === 'slow'
        ? new Promise<Response>((resolve) => (releaseFirst = resolve))
        : Response.json({ posts: [post({ title: 'Fresh' })], nextOffset: null }),
    );
    window.history.replaceState(null, '', '/?q=slow');
    render(<GalleryView />);
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    fireEvent.change(search(), { target: { value: 'fresh' } });
    expect(await screen.findByText('Fresh')).toBeTruthy();
    await act(async () =>
      releaseFirst(Response.json({ posts: [post({ title: 'Stale' })], nextOffset: null })),
    );
    expect(screen.queryByText('Stale')).toBeNull();
  });

  it('pages with Load More, and keeps the button when a page fails', async () => {
    let page = 0;
    route(isPosts, (url) => {
      const offset = Number(queryOf(url).get('offset') ?? 0);
      if (offset === 0) return Response.json({ posts: [post({ title: 'First' })], nextOffset: 24 });
      page += 1;
      return page === 1
        ? new Response(null, { status: 500 })
        : Response.json({ posts: [post({ title: 'Second' })], nextOffset: null });
    });
    render(<GalleryView />);
    await screen.findByText('First');
    fireEvent.click(screen.getByRole('button', { name: 'Load More' }));
    expect(await screen.findByText("We couldn't load more documents.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Second')).toBeTruthy();
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load More' })).toBeNull();
  });

  it('says when nothing matches, and Clear Filters keeps the sort', async () => {
    window.history.replaceState(null, '', '/?q=zzz%20sort%3Aloved');
    route(isPosts, (url) =>
      queryOf(url).get('q')?.includes('zzz')
        ? Response.json({ posts: [], nextOffset: null })
        : Response.json({ posts: [post()], nextOffset: null }),
    );
    render(<GalleryView />);
    expect(await screen.findByText('No documents match these filters.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    await screen.findByText('Post 1');
    expect(search().value).toBe('sort:loved');
  });

  it('invites the first share when the Community is empty', async () => {
    route(isPosts, () => Response.json({ posts: [], nextOffset: null }));
    render(<GalleryView />);
    expect(await screen.findByText('Nothing here yet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Share Your Own' }).getAttribute('href')).toBe(
      '/explorer/home',
    );
  });

  it('shows an error with Try Again, which loads again', async () => {
    let fail = true;
    route(isPosts, () =>
      fail
        ? new Response(null, { status: 500 })
        : Response.json({ posts: [post()], nextOffset: null }),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<GalleryView />);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText("We couldn't load the Community.")).toBeTruthy();
    fail = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Post 1')).toBeTruthy();
  });
});

describe('My Shares', () => {
  const minePost = (patch: Partial<CommunityMinePost> = {}): CommunityMinePost => ({
    ...post(),
    state: 'listed',
    documentId: 'doc-1',
    ...patch,
  });
  const totals: CommunityMineTotals = { posts: 2, likes: 7, copies: 3 };

  it("lists the author's own posts with their totals, marking a hidden one and opening it in the editor", async () => {
    h.session = { loaded: true, signedIn: true, userId: 'user_a', getToken: async () => 'token-1' };
    window.history.replaceState(null, '', '/?q=is%3Amine');
    route(isMine, () =>
      Response.json({
        posts: [
          minePost({ title: 'Listed one' }),
          minePost({ title: 'Hidden one', state: 'hidden', documentId: 'doc-9' }),
        ],
        nextOffset: null,
        totals,
      }),
    );
    render(<GalleryView />);
    expect(await screen.findByText('Listed one')).toBeTruthy();
    const mineCall = calls.find((c) => isMine(c.url))!;
    expect(new Headers(mineCall.init?.headers).get('Authorization')).toBe('Bearer token-1');
    expect(postCalls()).toHaveLength(0);

    const summary = screen.getByRole('region', { name: 'Your Shares' });
    expect(summary.textContent).toContain('2 documents shared');
    expect(summary.textContent).toContain('7 likes');
    expect(summary.textContent).toContain('3 copies made');

    expect(screen.getByText('Hidden')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hidden one' }).getAttribute('href')).toBe(
      '/document/doc-9',
    );
    expect(screen.getByRole('link', { name: 'Listed one' }).getAttribute('href')).toContain(
      '/post/?id=',
    );
    expect(screen.getByRole('button', { name: 'My Shares' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it("never shows one account's shares to another", async () => {
    h.session = { loaded: true, signedIn: true, userId: 'user_a', getToken: async () => 'token-a' };
    window.history.replaceState(null, '', '/?q=is%3Amine');
    route(isMine, (_url, init) =>
      Response.json({
        posts: [
          minePost({
            title:
              new Headers(init?.headers).get('Authorization') === 'Bearer token-b'
                ? 'B post'
                : 'A post',
          }),
        ],
        nextOffset: null,
        totals,
      }),
    );
    render(<GalleryView />);
    expect(await screen.findByText('A post')).toBeTruthy();
    act(() =>
      h.emit!({ loaded: true, signedIn: true, userId: 'user_b', getToken: async () => 'token-b' }),
    );
    expect(await screen.findByText('B post')).toBeTruthy();
    expect(screen.queryByText('A post')).toBeNull();
  });

  it('gives up, with Try Again, when sign-in never loads', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.session = null;
    window.history.replaceState(null, '', '/?q=is%3Amine');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<GalleryView />);
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(screen.getByText("We couldn't load the Community.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
  });

  it('waits afresh each time My Shares is turned on again after a time-out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.session = null;
    window.history.replaceState(null, '', '/?q=is%3Amine');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<GalleryView />);
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(screen.getByText("We couldn't load the Community.")).toBeTruthy();
    const toggle = () => screen.getByRole('button', { name: /My Shares/ });
    await act(async () => fireEvent.click(toggle()));
    await act(async () => fireEvent.click(toggle()));
    expect(screen.queryByText("We couldn't load the Community.")).toBeNull();
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(screen.getByText("We couldn't load the Community.")).toBeTruthy();
  });

  it('asks a signed-out visitor to sign in, coming back to the same view', async () => {
    h.session = { loaded: true, signedIn: false, userId: null, getToken: async () => null };
    window.history.replaceState(null, '', '/?q=is%3Amine');
    render(<GalleryView />);
    expect(await screen.findByText('Sign in to see your shares.')).toBeTruthy();
    const href = screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')!;
    expect(href.startsWith('/sign-in/?redirect_url=')).toBe(true);
    expect(decodeURIComponent(href.split('=').slice(1).join('='))).toBe('/?q=is%3Amine');
    expect(calls.some((c) => isMine(c.url))).toBe(false);
  });

  it('says so when you have shared nothing yet', async () => {
    h.session = { loaded: true, signedIn: true, userId: 'user_a', getToken: async () => 'token-1' };
    window.history.replaceState(null, '', '/?q=is%3Amine');
    route(isMine, () =>
      Response.json({ posts: [], nextOffset: null, totals: { posts: 0, likes: 0, copies: 0 } }),
    );
    render(<GalleryView />);
    expect(await screen.findByText("You haven't shared anything yet.")).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Your Shares' })).toBeNull();
  });

  it('turns on from the search box, counted as a choice', async () => {
    h.session = { loaded: true, signedIn: true, userId: 'user_a', getToken: async () => 'token-1' };
    route(isPosts, () => Response.json({ posts: [post()], nextOffset: null }));
    route(isMine, () =>
      Response.json({ posts: [], nextOffset: null, totals: { posts: 0, likes: 0, copies: 0 } }),
    );
    render(<GalleryView />);
    await screen.findByText('Post 1');
    fireEvent.click(screen.getByRole('button', { name: 'My Shares' }));
    await waitFor(() => expect(search().value).toBe('is:mine'));
    expect(h.telemetry.selected).toHaveBeenCalledWith('Mine');
    expect(await screen.findByText("You haven't shared anything yet.")).toBeTruthy();
  });
});
