// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForumReply, ForumTopic, ForumTopicSummary } from '@liveworkspace/community';

// The Forum's pages (liveworkspace/docs/specs/007-community/community.md "The Forum"): anyone reads the list and a
// topic; signing in is what Ask, Reply, reactions, Mark as Answer, Edit and Delete need, and each write carries the
// account's token; a post nobody else sees yet says so to its author; reports go through the gallery's dialog.

// Telemetry fires from an effect or after a state update, so it can land just after the screen the test waited for.
// Wait for it, then let the page settle and check it did not fire twice.
async function firedOnce(fn: { mock: { calls: unknown[] } }) {
  await waitFor(() => expect(fn.mock.calls).toHaveLength(1));
  await act(async () => {});
  expect(fn.mock.calls).toHaveLength(1);
}

type Account =
  | { status: 'checking' }
  | { status: 'out' }
  | {
      status: 'in';
      author: { name: string; color: string | null };
      getToken: () => Promise<string | null>;
    };

const h = vi.hoisted(() => ({
  id: 'top1' as string | null,
  push: vi.fn(),
  account: { status: 'out' } as Account,
  telemetry: {
    opened: vi.fn(),
    openedTopic: vi.fn(),
    postedTopic: vi.fn(),
    postedReply: vi.fn(),
    reacted: vi.fn(),
    markedAnswer: vi.fn(),
  },
  reported: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(h.id ? { id: h.id } : {}),
  useRouter: () => ({ push: h.push }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('./useForumAccount', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useForumAccount')>()),
  useForumAccount: () => h.account,
}));

import { ForumListPage } from './ForumListPage';
import { ForumTopicPage } from './ForumTopicPage';
import { communityTestSite, quietCommunityTelemetry, withCommunitySite } from '../test/site';

const API = 'https://community.test';
const wrapper = withCommunitySite(
  communityTestSite({
    communityApi: API,
    telemetry: { ...quietCommunityTelemetry, reported: h.reported, forum: h.telemetry },
  }),
);

const ADA = { name: 'Ada', color: '#2563eb' };
const BO = { name: 'Bo', color: '#db2777' };
const NONE = { counts: { helpful: 0, thanks: 0, celebrate: 0 }, mine: [] };
const T0 = Date.UTC(2026, 10, 10, 12);

const summary = (over: Partial<ForumTopicSummary> = {}): ForumTopicSummary => ({
  id: 'top1',
  category: 'question',
  app: 'livediagram.app',
  title: 'How do I curve a line?',
  excerpt: 'I tried dragging the middle.',
  author: ADA,
  replyCount: 2,
  answered: false,
  createdAt: T0,
  activityAt: T0,
  state: 'listed',
  own: false,
  ...over,
});

const topic = (over: Partial<ForumTopic> = {}): ForumTopic => ({
  id: 'top1',
  topicId: null,
  category: 'question',
  app: 'livediagram.app',
  title: 'How do I curve a line?',
  body: 'I tried dragging the middle.\n\nNothing happened.',
  author: ADA,
  createdAt: T0,
  editedAt: null,
  state: 'listed',
  own: false,
  reactions: NONE,
  answerId: null,
  ...over,
});

const reply = (id: string, over: Partial<ForumReply> = {}): ForumReply => ({
  id,
  topicId: 'top1',
  body: `Reply ${id}`,
  author: BO,
  createdAt: T0 + 1000,
  editedAt: null,
  state: 'listed',
  own: false,
  reactions: NONE,
  ...over,
});

type Call = { url: string; method: string; auth: string | null; key: string | null; body: unknown };
const calls: Call[] = [];
let answer: (call: Call) => Response | Promise<Response>;
// A topic's sidebar reads its Popular Posts from an effect that can run after the screen a test waited for, so
// after the test has moved `answer` on to a write's reply. Set on a topic, the topic list is answered from here.
let popularList: ((call: Call) => Response) | null;
const isList = (call: Call) => call.url.includes('/forum/topics?');

const signedIn = (name = 'Ada'): Account => ({
  status: 'in',
  author: { name, color: '#2563eb' },
  getToken: async () => 'tok-1',
});

beforeEach(() => {
  h.id = 'top1';
  h.account = { status: 'out' };
  h.push.mockReset();
  h.reported.mockReset();
  for (const fn of Object.values(h.telemetry)) fn.mockReset();
  calls.length = 0;
  window.history.replaceState(null, '', '/community/forum');
  answer = () => Response.json({ topics: [summary()], nextOffset: null });
  popularList = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const headers = (init.headers ?? {}) as Record<string, string>;
      const call: Call = {
        url: String(input),
        method: init.method ?? 'GET',
        auth: headers.Authorization ?? null,
        key: headers['X-Community-Key'] ?? null,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : null,
      };
      calls.push(call);
      return popularList && isList(call) ? popularList(call) : answer(call);
    }),
  );
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Forum list', () => {
  it('reads without signing in, and asks a visitor to sign in to ask', async () => {
    render(<ForumListPage />, { wrapper });
    const link = await screen.findByRole('link', { name: 'How do I curve a line?' });
    expect(link.getAttribute('href')).toBe('/community/forum/topic?id=top1');
    expect(calls[0]).toMatchObject({ url: `${API}/forum/topics`, method: 'GET', auth: null });
    const ask = screen.getAllByRole('link', { name: 'Sign In to Post' })[0]!;
    expect(ask.getAttribute('href')).toContain('community%2Fforum');
    expect(screen.queryByRole('button', { name: 'New Post' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Forum' }).getAttribute('aria-current')).toBe('page');
    await firedOnce(h.telemetry.opened);
  });

  it('marks an answered topic and counts its replies', async () => {
    answer = () =>
      Response.json({ topics: [summary({ answered: true, replyCount: 1 })], nextOffset: null });
    render(<ForumListPage />, { wrapper });
    await screen.findByText('Answered');
    expect(screen.getByLabelText('1 reply')).toBeTruthy();
  });

  it('chooses a category in the address and reads it again', async () => {
    render(<ForumListPage />, { wrapper });
    await screen.findByRole('link', { name: 'How do I curve a line?' });
    fireEvent.click(screen.getByRole('button', { name: 'General' }));
    await waitFor(() => expect(calls.length).toBe(2));
    expect(window.location.search).toBe('?category=general');
    expect(calls[1]!.url).toBe(`${API}/forum/topics?category=general`);
    expect(screen.getByRole('button', { name: 'General' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('says when there are no posts yet', async () => {
    answer = () => Response.json({ topics: [], nextOffset: null });
    render(<ForumListPage />, { wrapper });
    await screen.findByText('No posts yet.');
    expect(screen.getByText('Be the first to post.')).toBeTruthy();
  });

  it('says when the list fails, and Try Again reads it again', async () => {
    answer = () => new Response('{}', { status: 500 });
    render(<ForumListPage />, { wrapper });
    await screen.findByText("We couldn't load the Forum.");
    answer = () => Response.json({ topics: [summary()], nextOffset: null });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await screen.findByRole('link', { name: 'How do I curve a line?' });
  });

  it('loads more topics after the first page', async () => {
    answer = (call) =>
      call.url.includes('offset=20')
        ? Response.json({
            topics: [summary({ id: 'top2', title: 'Second page topic' })],
            nextOffset: null,
          })
        : Response.json({ topics: [summary()], nextOffset: 20 });
    render(<ForumListPage />, { wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'Load More' }));
    await screen.findByRole('link', { name: 'Second page topic' });
    expect(screen.queryByRole('button', { name: 'Load More' })).toBeNull();
  });

  it("shows a signed-in author's own waiting topic, marked, and reads with their token", async () => {
    h.account = signedIn();
    answer = () =>
      Response.json({ topics: [summary({ own: true, state: 'pending' })], nextOffset: null });
    render(<ForumListPage />, { wrapper });
    await screen.findByText('Pending');
    expect(calls[0]!.auth).toBe('Bearer tok-1');
  });

  it('writes a New Post in a popover, never disabled without a reason, then opens it', async () => {
    h.account = signedIn();
    render(<ForumListPage />, { wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'New Post' }));
    const dialog = screen.getByRole('dialog', { name: 'New Post' });
    const post = within(dialog).getByRole('button', { name: 'Post' });
    expect((post as HTMLButtonElement).disabled).toBe(false);
    // Pressed empty: each field says what it needs, and the first takes focus. Nothing is sent.
    fireEvent.click(post);
    expect(screen.getByText('Add a title of at least 5 characters.')).toBeTruthy();
    expect(screen.getByText('Write at least 10 characters.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Title'));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    // A new post starts on the page's app; the picker shows every app and Any App.
    expect(
      within(dialog).getByRole('radio', { name: 'livediagram' }).getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'liveplanner' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Where is the grid?' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'tips' } });
    fireEvent.change(screen.getByLabelText('Your Post'), {
      target: { value: 'I cannot find it anywhere.' },
    });
    answer = (call) =>
      call.method === 'POST'
        ? Response.json(
            { topic: topic({ id: 'new1', own: true, state: 'pending' }) },
            { status: 201 },
          )
        : Response.json({ topics: [], nextOffset: null });
    fireEvent.click(post);
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/community/forum/topic?id=new1'));
    const sent = calls.find((c) => c.method === 'POST');
    expect(sent).toMatchObject({
      url: `${API}/forum/topics`,
      auth: 'Bearer tok-1',
      body: {
        category: 'tips',
        app: 'liveplanner.app',
        title: 'Where is the grid?',
        body: 'I cannot find it anywhere.',
        author: { name: 'Ada', color: '#2563eb' },
      },
    });
    await firedOnce(h.telemetry.postedTopic);
  });

  it('says why a post was refused, and keeps it to try again', async () => {
    h.account = signedIn();
    render(<ForumListPage />, { wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'New Post' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Where is the grid?' } });
    fireEvent.change(screen.getByLabelText('Your Post'), {
      target: { value: 'I cannot find it anywhere.' },
    });
    answer = () => Response.json({ error: 'rate_limited' }, { status: 429 });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await screen.findByText(/posted a lot in the last hour/);
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('Where is the grid?');
    expect(h.push).not.toHaveBeenCalled();
  });

  it('filters by app in the address, each app by its logo', async () => {
    render(<ForumListPage />, { wrapper });
    await screen.findByRole('link', { name: 'How do I curve a line?' });
    fireEvent.click(screen.getByRole('button', { name: 'Filter by App' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'livedesign' }));
    await waitFor(() => expect(calls.length).toBe(2));
    expect(window.location.search).toBe('?app=livedesign');
    expect(calls[1]!.url).toBe(`${API}/forum/topics?app=livedesign`);
    expect(screen.getByRole('button', { name: 'App: livedesign' })).toBeTruthy();
  });
});

describe('a Forum topic', () => {
  // An empty list for the sidebar's Popular Posts, whenever it asks.
  beforeEach(() => {
    popularList = () => Response.json({ topics: [], nextOffset: null });
  });
  const read = (t: ForumTopic, replies: ForumReply[]) => () => Response.json({ topic: t, replies });
  // The last write, past any Popular Posts read.
  const lastWrite = () => calls.filter((c) => !isList(c)).at(-1);
  // The replies' cards, apart from the sidebar's rows.
  const replyCards = () =>
    within(screen.getByRole('region', { name: /Repl/ })).getAllByRole('listitem');

  it("sits in the Forum's hero, with a back bar, Popular Posts and the categories beside it", async () => {
    popularList = () =>
      Response.json({
        topics: [
          summary(),
          summary({ id: 'pop1', title: 'Snap to the grid', category: 'tips', replyCount: 6 }),
        ],
        nextOffset: null,
      });
    answer = () => Response.json({ topic: topic({ category: 'showcase' }), replies: [] });
    render(<ForumTopicPage />, { wrapper });
    await screen.findByRole('heading', { level: 1, name: 'How do I curve a line?' });
    // The same hero as the list, its heading a plain line: the topic's title is the page's h1.
    expect(screen.getByText('Community Forum').tagName).toBe('P');
    expect(screen.getByRole('link', { name: 'Forum' }).getAttribute('aria-current')).toBe('page');
    // The shared back bar, the topic's category as its chip.
    const back = screen.getByRole('button', { name: /All Posts/ });
    expect(within(back).getByText('Show & Tell')).toBeTruthy();
    fireEvent.click(back);
    expect(h.push).toHaveBeenCalledWith('/community/forum');
    // Popular Posts, read anonymously and leaving this topic out.
    const popular = await screen.findByRole('region', { name: 'Popular Posts' });
    expect(calls.find((c) => c.url.includes('sort=popular'))).toMatchObject({ auth: null });
    expect(
      within(popular)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['See All', expect.stringContaining('Snap to the grid')]);
    const categories = screen.getByRole('navigation', { name: 'Browse Categories' });
    const showcase = within(categories).getByRole('link', { name: /Show & Tell/ });
    expect(showcase.getAttribute('href')).toBe('/community/forum?category=showcase');
    expect(showcase.getAttribute('aria-current')).toBe('true');
  });

  it('marks no answer on a post that is not a Question', async () => {
    h.account = signedIn();
    answer = read(topic({ own: true, category: 'tips' }), [reply('r1')]);
    render(<ForumTopicPage />, { wrapper });
    await screen.findByText('Reply r1');
    expect(screen.queryByRole('button', { name: /Mark as Answer/ })).toBeNull();
  });

  it('says what a reply needs rather than disabling Reply', async () => {
    h.account = signedIn('Cy');
    answer = read(topic(), []);
    render(<ForumTopicPage />, { wrapper });
    const send = await screen.findByRole('button', { name: 'Reply' });
    expect((send as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(send);
    expect(screen.getByText('Write at least 2 characters.')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
  it('reads signed out: the answer first, counts without toggles, Report, and Sign In to Reply', async () => {
    answer = read(topic({ answerId: 'r2' }), [reply('r1'), reply('r2')]);
    render(<ForumTopicPage />, { wrapper });
    await screen.findByRole('heading', { level: 1, name: 'How do I curve a line?' });
    const cards = replyCards();
    expect(within(cards[0]!).getByText('Reply r2')).toBeTruthy();
    expect(within(cards[0]!).getByText('Answer')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '2 Replies' })).toBeTruthy();
    expect(screen.queryAllByRole('button', { pressed: false })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Report' })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Mark as Answer/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign In to Reply' })).toBeTruthy();
    await firedOnce(h.telemetry.openedTopic);
  });

  it("says a topic that isn't there, with a way back", async () => {
    answer = () => Response.json({ error: 'not_found' }, { status: 404 });
    render(<ForumTopicPage />, { wrapper });
    await screen.findByText("This topic isn't here.");
    expect(screen.getByRole('link', { name: 'Back to the Forum' }).getAttribute('href')).toBe(
      '/community/forum',
    );
  });

  it('is gone without an id, asking nothing', async () => {
    h.id = null;
    render(<ForumTopicPage />, { wrapper });
    await screen.findByText("This topic isn't here.");
    expect(calls).toHaveLength(0);
  });

  it("lets the question's author mark a reply as the answer, moving it first", async () => {
    h.account = signedIn();
    answer = read(topic({ own: true }), [reply('r1'), reply('r2')]);
    render(<ForumTopicPage />, { wrapper });
    await screen.findByText('Reply r2');
    answer = () => Response.json({ answerId: 'r2' });
    fireEvent.click(screen.getAllByRole('button', { name: /Mark as Answer/ })[1]!);
    await waitFor(() => expect(within(replyCards()[0]!).getByText('Reply r2')).toBeTruthy());
    const sent = lastWrite();
    expect(sent).toMatchObject({
      url: `${API}/forum/topics/top1/answer`,
      method: 'PUT',
      auth: 'Bearer tok-1',
      body: { reply: 'r2' },
    });
    await firedOnce(h.telemetry.markedAnswer);
    expect(screen.getByRole('button', { name: /Unmark Answer/ })).toBeTruthy();
  });

  it('gives a reaction at once, then keeps the count the service answers', async () => {
    h.account = signedIn('Cy');
    answer = read(topic(), []);
    render(<ForumTopicPage />, { wrapper });
    const helpful = await screen.findByRole('button', { name: 'Helpful, 0' });
    answer = () =>
      Response.json({
        reactions: { counts: { helpful: 4, thanks: 0, celebrate: 0 }, mine: ['helpful'] },
      });
    fireEvent.click(helpful);
    await screen.findByRole('button', { name: 'Take Back Helpful, 4' });
    expect(lastWrite()).toMatchObject({
      url: `${API}/forum/posts/top1/reactions/helpful`,
      method: 'PUT',
      auth: 'Bearer tok-1',
    });
    expect(h.telemetry.reacted).toHaveBeenCalledWith('helpful');
  });

  it('puts a reaction back when the service refuses it', async () => {
    h.account = signedIn('Cy');
    answer = read(topic(), []);
    render(<ForumTopicPage />, { wrapper });
    const thanks = await screen.findByRole('button', { name: 'Thanks, 0' });
    answer = () => new Response('{}', { status: 500 });
    fireEvent.click(thanks);
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Thanks, 0' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('replies in place with the token, and shows the reply', async () => {
    h.account = signedIn('Cy');
    answer = read(topic(), []);
    render(<ForumTopicPage />, { wrapper });
    fireEvent.change(await screen.findByLabelText('Your Reply'), {
      target: { value: 'Hold Alt and drag.' },
    });
    answer = () =>
      Response.json(
        { reply: reply('r9', { body: 'Hold Alt and drag.', own: true, state: 'pending' }) },
        { status: 201 },
      );
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    await screen.findByText('Hold Alt and drag.', { selector: 'p' });
    expect(lastWrite()).toMatchObject({
      url: `${API}/forum/topics/top1/replies`,
      method: 'POST',
      auth: 'Bearer tok-1',
      body: { body: 'Hold Alt and drag.', author: { name: 'Cy' } },
    });
    // Waiting for the check: its author is told.
    expect(screen.getByText(/Pending: being checked/)).toBeTruthy();
    await firedOnce(h.telemetry.postedReply);
  });

  it('edits its own reply in place, and saves it with the token', async () => {
    h.account = signedIn('Bo');
    answer = read(topic(), [reply('r1', { own: true })]);
    render(<ForumTopicPage />, { wrapper });
    await screen.findByText('Reply r1');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const field = screen.getByLabelText('Your Reply', { selector: 'textarea[aria-label]' });
    fireEvent.change(field, { target: { value: 'Better words.' } });
    answer = () =>
      Response.json({
        post: reply('r1', { own: true, body: 'Better words.', editedAt: T0 + 5000 }),
      });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Better words.');
    expect(screen.getByText('edited')).toBeTruthy();
    expect(lastWrite()).toMatchObject({
      url: `${API}/forum/posts/r1`,
      method: 'PATCH',
      auth: 'Bearer tok-1',
    });
    expect(screen.queryByRole('button', { name: 'Report' })).toBeTruthy();
  });

  it('keeps the marked answer when the asker edits the question', async () => {
    h.account = signedIn();
    answer = read(topic({ own: true, answerId: 'r2' }), [reply('r1'), reply('r2')]);
    render(<ForumTopicPage />, { wrapper });
    await screen.findByText('Reply r2');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Your Post', { selector: 'textarea[aria-label]' }), {
      target: { value: 'Clearer words.' },
    });
    // The service's edit answers the topic without its answer.
    answer = () =>
      Response.json({
        post: topic({ own: true, body: 'Clearer words.', editedAt: T0 + 5000, answerId: null }),
      });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Clearer words.');
    expect(within(replyCards()[0]!).getByText('Answer')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Unmark Answer/ })).toBeTruthy();
  });

  it('asks before deleting its own reply: Keep leaves it, Delete removes it', async () => {
    h.account = signedIn('Bo');
    answer = read(topic(), [reply('r1', { own: true })]);
    render(<ForumTopicPage />, { wrapper });
    await screen.findByText('Reply r1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.getByText('Reply r1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    answer = () => new Response(null, { status: 204 });
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Delete this reply?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => expect(screen.queryByText('Reply r1')).toBeNull());
    expect(lastWrite()).toMatchObject({
      url: `${API}/forum/posts/r1`,
      method: 'DELETE',
      auth: 'Bearer tok-1',
    });
  });

  it('leaves the topic for the Forum when its author deletes it', async () => {
    h.account = signedIn();
    answer = read(topic({ own: true }), []);
    render(<ForumTopicPage />, { wrapper });
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    answer = () => new Response(null, { status: 204 });
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Delete this post?' })).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/community/forum'));
  });

  it("tells the author a refused or hidden post's state, and offers no Edit on a hidden one", async () => {
    h.account = signedIn();
    answer = read(topic({ own: true, state: 'refused' }), [
      reply('r1', { own: true, state: 'hidden' }),
    ]);
    render(<ForumTopicPage />, { wrapper });
    await screen.findByText(/Didn't pass the community check/);
    expect(screen.getByText(/Hidden after reports/)).toBeTruthy();
    // The question can be edited to try again; the hidden reply only deleted. Nobody reacts to either.
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Helpful/ })).toBeNull();
    // A topic nobody else sees takes no replies yet.
    expect(screen.queryByLabelText('Your Reply')).toBeNull();
  });

  it("reports someone else's reply through the dialog, with the browser's community key", async () => {
    answer = read(topic(), [reply('r1')]);
    render(<ForumTopicPage />, { wrapper });
    await screen.findByText('Reply r1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Report' })[1]!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Report This Reply')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Spam' }));
    answer = () => new Response(null, { status: 204 });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Send Report' }));
    });
    await within(dialog).findByText(/Thanks for letting us know/);
    const sent = lastWrite();
    expect(sent).toMatchObject({
      url: `${API}/forum/posts/r1/report`,
      method: 'POST',
      body: { reason: 'spam' },
    });
    expect(sent?.auth).toBeNull();
    expect(sent?.key).toBeTruthy();
    expect(h.reported).toHaveBeenCalledWith('spam');
  });
});
