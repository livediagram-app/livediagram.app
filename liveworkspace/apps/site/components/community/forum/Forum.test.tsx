// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ForumReply, ForumTopic, ForumTopicSummary } from '@liveworkspace/community';

// The Forum's pages (liveworkspace/docs/specs/007-community/community.md "The Forum"): anyone reads the list and a
// topic; signing in is what Ask, Reply, reactions, Mark as Answer, Edit and Delete need, and each write carries the
// account's token; a post nobody else sees yet says so to its author; reports go through the gallery's dialog.

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
  category: 'livediagram',
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
  category: 'livediagram',
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
      return answer(call);
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
    const ask = screen.getAllByRole('link', { name: 'Sign In to Ask' })[0]!;
    expect(ask.getAttribute('href')).toContain('community%2Fforum');
    expect(screen.queryByRole('button', { name: /Ask a Question/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Forum' }).getAttribute('aria-current')).toBe('page');
    expect(h.telemetry.opened).toHaveBeenCalledTimes(1);
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

  it('says when there are no questions yet', async () => {
    answer = () => Response.json({ topics: [], nextOffset: null });
    render(<ForumListPage />, { wrapper });
    await screen.findByText('No questions yet.');
    expect(screen.getByText('Be the first to ask.')).toBeTruthy();
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

  it('asks a question in place, with the token and the author, then opens it', async () => {
    h.account = signedIn();
    render(<ForumListPage />, { wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'Ask a Question' }));
    const post = screen.getByRole('button', { name: 'Post Question' });
    expect((post as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Where is the grid?' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'general' } });
    fireEvent.change(screen.getByLabelText('Your Question'), {
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
        category: 'general',
        title: 'Where is the grid?',
        body: 'I cannot find it anywhere.',
        author: { name: 'Ada', color: '#2563eb' },
      },
    });
    expect(h.telemetry.postedTopic).toHaveBeenCalledTimes(1);
  });

  it('says why a question was refused, and keeps it to try again', async () => {
    h.account = signedIn();
    render(<ForumListPage />, { wrapper });
    fireEvent.click(await screen.findByRole('button', { name: 'Ask a Question' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Where is the grid?' } });
    fireEvent.change(screen.getByLabelText('Your Question'), {
      target: { value: 'I cannot find it anywhere.' },
    });
    answer = () => Response.json({ error: 'rate_limited' }, { status: 429 });
    fireEvent.click(screen.getByRole('button', { name: 'Post Question' }));
    await screen.findByText(/posted a lot in the last hour/);
    expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe('Where is the grid?');
    expect(h.push).not.toHaveBeenCalled();
  });
});

describe('a Forum topic', () => {
  const read = (t: ForumTopic, replies: ForumReply[]) => () => Response.json({ topic: t, replies });

  it('reads signed out: the answer first, counts without toggles, Report, and Sign In to Reply', async () => {
    answer = read(topic({ answerId: 'r2' }), [reply('r1'), reply('r2')]);
    render(<ForumTopicPage />, { wrapper });
    await screen.findByRole('heading', { level: 1, name: 'How do I curve a line?' });
    const cards = screen.getAllByRole('listitem');
    expect(within(cards[0]!).getByText('Reply r2')).toBeTruthy();
    expect(within(cards[0]!).getByText('Answer')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '2 Replies' })).toBeTruthy();
    expect(screen.queryAllByRole('button', { pressed: false })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: 'Report' })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Mark as Answer/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign In to Reply' })).toBeTruthy();
    expect(h.telemetry.openedTopic).toHaveBeenCalledTimes(1);
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
    await waitFor(() =>
      expect(within(screen.getAllByRole('listitem')[0]!).getByText('Reply r2')).toBeTruthy(),
    );
    const sent = calls.at(-1);
    expect(sent).toMatchObject({
      url: `${API}/forum/topics/top1/answer`,
      method: 'PUT',
      auth: 'Bearer tok-1',
      body: { reply: 'r2' },
    });
    expect(h.telemetry.markedAnswer).toHaveBeenCalledTimes(1);
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
    expect(calls.at(-1)).toMatchObject({
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
    expect(calls.at(-1)).toMatchObject({
      url: `${API}/forum/topics/top1/replies`,
      method: 'POST',
      auth: 'Bearer tok-1',
      body: { body: 'Hold Alt and drag.', author: { name: 'Cy' } },
    });
    // Waiting for the check: its author is told.
    expect(screen.getByText(/Pending: being checked/)).toBeTruthy();
    expect(h.telemetry.postedReply).toHaveBeenCalledTimes(1);
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
    expect(calls.at(-1)).toMatchObject({
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
    fireEvent.change(screen.getByLabelText('Your Question', { selector: 'textarea[aria-label]' }), {
      target: { value: 'Clearer words.' },
    });
    // The service's edit answers the topic without its answer.
    answer = () =>
      Response.json({
        post: topic({ own: true, body: 'Clearer words.', editedAt: T0 + 5000, answerId: null }),
      });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Clearer words.');
    expect(within(screen.getAllByRole('listitem')[0]!).getByText('Answer')).toBeTruthy();
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
    expect(calls.at(-1)).toMatchObject({
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
      within(screen.getByRole('group', { name: 'Delete this question?' })).getByRole('button', {
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
    const sent = calls.at(-1);
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
