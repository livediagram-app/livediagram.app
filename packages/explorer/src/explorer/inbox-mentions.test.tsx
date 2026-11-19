// Work Tracker 1036: a mention keeps naming who mentioned you whoever replies after (you included), your own reply
// never reads as you acting on yourself, a reply sent from the pane counts in the thread's heading at once, and the
// sidebar's Inbox badge drops on Resolve and shows nothing at 0.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxThread } from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import type { InboxActions, InboxTarget, InboxVerb } from '../types';
import { Explorer, type ExplorerProps } from './Explorer';
import { entryFacts } from './inbox/InboxRows';
import { sentMissingFrom } from './inbox/InboxReaderBody';
import {
  inboxBadge,
  inboxEntries,
  inboxSections,
  settledOf,
  withoutSettled,
  type InboxEntry,
} from './inbox/sections';
import type { InboxData } from '../data/useInbox';

const NOW = new Date(2026, 9, 28, 12, 0).getTime();
const MIN = 60_000;
const ADA = { id: 'user_ada', name: 'Ada King', color: '#f97316' };

const thread = (patch: Partial<InboxThread> = {}): InboxThread => ({
  app: 'liveplanner',
  itemId: 'plan-1',
  itemTitle: 'Launch',
  itemTeamId: 'team-1',
  tabId: 'tab-1',
  tabName: 'Roadmap',
  elementId: 'el-2',
  elementLabel: 'Budget',
  resolved: false,
  commentCount: 1,
  latestText: 'Hey @me can you check this?',
  latestAuthorName: 'Ada King',
  latestAuthorColor: '#f97316',
  latestAuthorId: 'user_ada',
  card: null,
  mentionsYou: true,
  mentionedBy: ADA,
  youCommented: false,
  onYourItem: false,
  firstAt: 1,
  latestAt: NOW - 20 * MIN,
  ...patch,
});

// Bea (the viewer) replied "On it" after Ada's mention.
const afterMyReply = (patch: Partial<InboxThread> = {}) =>
  thread({
    commentCount: 2,
    latestText: 'On it',
    latestAuthorName: 'Bea Qa',
    latestAuthorColor: '#0ea5e9',
    latestAuthorId: 'user_me',
    youCommented: true,
    latestAt: NOW - MIN,
    ...patch,
  });

// Cy, a third person, replied after Ada's mention.
const afterCysReply = (patch: Partial<InboxThread> = {}) =>
  thread({
    commentCount: 2,
    latestText: 'Me too',
    latestAuthorName: 'Cy Long',
    latestAuthorColor: '#22c55e',
    latestAuthorId: 'user_cy',
    latestAt: NOW - MIN,
    ...patch,
  });

const data = (threads: InboxThread[]): InboxData => ({ threads, actions: [], forms: [] });
const entryOf = (t: InboxThread): InboxEntry =>
  inboxEntries(inboxSections(data([t]), 'user_me'))[0]!;
const facts = (t: InboxThread) => entryFacts(entryOf(t), 'user_me');

function host(verbs: InboxVerb[], over: Partial<InboxActions> = {}) {
  return {
    offers: vi.fn((_t: InboxTarget) => verbs),
    reply: vi.fn(async () => {}),
    resolve: vi.fn(async () => {}),
    done: vi.fn(async () => {}),
    ...over,
  } satisfies InboxActions;
}

function renderInbox(index: ReturnType<typeof createFakeIndex>, over: Partial<ExplorerProps> = {}) {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'inbox' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/open/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      {...over}
    />,
  );
}

// The toast stack is a region too ("Notifications"); the pane is the other one.
const pane = () => screen.getByRole('region', { name: /^(?!Notifications$)./ });
const inboxRow = () => screen.getByRole('treeitem', { name: /^Inbox/ });

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('a mention after a reply', () => {
  it('still names who mentioned you after you reply yourself', () => {
    const f = facts(afterMyReply());
    expect(f.reason?.label).toBe('Mentioned you');
    expect(f.who).toBe('Ada King');
    expect(f.person).toMatchObject({ id: 'user_ada', name: 'Ada King', color: '#f97316' });
    // The latest comment is still yours.
    expect(f.latest).toMatchObject({ mine: true });
  });

  it('still names who mentioned you after a third person replies', () => {
    const f = facts(afterCysReply());
    expect(f.who).toBe('Ada King');
    expect(f.latest).toMatchObject({ mine: false, person: { id: 'user_cy', name: 'Cy Long' } });
  });

  it('never reads as you mentioning yourself on a row pushed before the app said who mentioned you', () => {
    // Your reply was last: nobody else is known, so a teammate, never you.
    const mine = facts(afterMyReply({ mentionedBy: undefined }));
    expect(mine.who).toBe('A teammate');
    expect(mine.person).toEqual({ id: null, name: null });
    // Someone else was last: they are the best guess, as before.
    expect(facts(afterCysReply({ mentionedBy: null })).who).toBe('Cy Long');
    // A mentioner the app named as you (a self-mention through a team member id) names no one either.
    expect(facts(afterMyReply({ mentionedBy: { id: 'user_me', name: 'Bea Qa' } })).who).toBe(
      'A teammate',
    );
    // Nor does one with no name.
    expect(facts(afterCysReply({ mentionedBy: { id: 'user_ada', name: ' ' } })).who).toBe(
      'A teammate',
    );
    // With no latest author's name at all, a teammate.
    expect(facts(thread({ mentionedBy: undefined, latestAuthorName: '' })).who).toBe('A teammate');
  });

  it('says who mentioned you in the row and the pane, with your reply as yours', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(afterMyReply());
    renderInbox(index);
    const row = within(await screen.findByRole('listbox')).getByRole('option');
    expect(row.querySelector('[data-inbox-who]')!.textContent).toBe('Ada King');
    expect(row.querySelector('[data-inbox-reason]')!.textContent).toBe('Mentioned you');
    expect(within(pane()).getByText('Ada mentioned you')).toBeTruthy();
    // The latest comment, before the thread is read, is yours.
    const thread = pane().querySelector('[data-inbox-thread]')!;
    expect(within(thread as HTMLElement).getByText('You')).toBeTruthy();
    expect(within(thread as HTMLElement).queryByText('Ada King')).toBeNull();
  });

  it('says a teammate mentioned you, not "A", when nobody is named', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(afterMyReply({ mentionedBy: undefined }));
    renderInbox(index, { inbox: { actions: host(['reply']) } });
    await screen.findByRole('listbox');
    expect(within(pane()).getByText('A teammate mentioned you')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Reply' }).getAttribute('placeholder')).toBe(
      'Reply to the thread…',
    );
  });
});

describe('a reply sent from the pane', () => {
  it('counts in the thread’s heading at once', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread());
    renderInbox(index, { inbox: { actions: host(['reply']) } });
    await screen.findByText('Thread · 1 comment');
    const field = screen.getByRole('textbox', { name: 'Reply' });
    fireEvent.change(field, { target: { value: 'On it' } });
    fireEvent.keyDown(field, { key: 'Enter', metaKey: true });
    await screen.findByText('Thread · 2 comments');
  });

  it('counts what the thread read holds once it is read again', async () => {
    const replies: string[] = [];
    const loadThread = vi.fn(async () => [
      { id: 'c1', authorName: 'Ada King', text: 'Hey @me can you check this?', at: NOW - MIN },
      ...replies.map((text, i) => ({ id: `r${i}`, authorName: null, mine: true, text, at: NOW })),
    ]);
    const reply = vi.fn(async (_t: InboxTarget, text: string) => {
      replies.push(text);
    });
    const index = createFakeIndex();
    index.inbox.threads.push(thread());
    renderInbox(index, { inbox: { actions: host(['reply'], { loadThread, reply }) } });
    await waitFor(() => expect(loadThread).toHaveBeenCalledTimes(1));
    const field = screen.getByRole('textbox', { name: 'Reply' });
    fireEvent.change(field, { target: { value: 'On it' } });
    fireEvent.keyDown(field, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(loadThread).toHaveBeenCalledTimes(2));
    await screen.findByText('Thread · 2 comments');
  });
  it('keeps a just-sent reply and its count when the re-read comes back without it', async () => {
    const loadThread = vi.fn(async () => [
      { id: 'c1', authorName: 'Ada King', text: 'Hey @me can you check this?', at: NOW - MIN },
    ]);
    const index = createFakeIndex();
    index.inbox.threads.push(thread());
    renderInbox(index, { inbox: { actions: host(['reply'], { loadThread }) } });
    await waitFor(() => expect(loadThread).toHaveBeenCalledTimes(1));
    const field = screen.getByRole('textbox', { name: 'Reply' });
    fireEvent.change(field, { target: { value: 'On it' } });
    fireEvent.keyDown(field, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(loadThread).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.getAllByText('On it')).toHaveLength(1);
    expect(screen.getByText('Thread · 2 comments')).toBeTruthy();
  });

  it('matches each sent reply to one of your own comments in the read', () => {
    const mine = (id: string, text: string) => ({
      id,
      authorName: null,
      mine: true,
      text,
      at: NOW,
    });
    const sent = [mine('s0', 'Yes'), mine('s1', 'Yes'), mine('s2', 'Later')];
    const read = [{ id: 'c1', authorName: 'Ada', text: 'Yes', at: NOW - MIN }, mine('r1', 'Yes')];
    expect(sentMissingFrom(read, sent).map((c) => c.id)).toEqual(['s1', 's2']);
    expect(sentMissingFrom(read, [])).toEqual([]);
  });
});

describe('the sidebar’s Inbox badge', () => {
  it('counts what waits on you, drops at once on Resolve, and shows nothing at 0', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread());
    renderInbox(index, { inbox: { actions: host(['reply', 'resolve']) } });
    await waitFor(() => expect(inboxRow().getAttribute('aria-label')).toBe('Inbox (1)'));
    fireEvent.click(within(pane()).getByRole('button', { name: /Resolve/ }));
    // The index still lists it until the app's next push: the badge drops anyway, with no "0".
    await screen.findByText(/all caught up/i);
    expect(inboxRow().getAttribute('aria-label')).toBe('Inbox');
    expect(within(inboxRow()).queryByText('0')).toBeNull();
  });

  it('is nothing at 0 and while unread', () => {
    expect(inboxBadge(null, 'user_me')).toBeUndefined();
    expect(inboxBadge(data([]), 'user_me')).toBeUndefined();
    expect(inboxBadge(data([thread()]), 'user_me')).toBe(1);
  });
});

describe('a row done from the pane', () => {
  it('stays out while reads list it as it was, and comes back once it changes', () => {
    const t = thread();
    const { key, at } = settledOf(entryOf(t));
    const settled = new Map([[key, at]]);
    expect(withoutSettled(data([t]), settled).threads).toEqual([]);
    expect(withoutSettled(data([{ ...t, latestAt: at + 1 }]), settled).threads).toHaveLength(1);
    // Nothing done: the same data.
    const same = data([t]);
    expect(withoutSettled(same, new Map())).toBe(same);
  });

  it('holds a card thread out in every plan that lists it', () => {
    const card = {
      id: 'card-1',
      key: 3,
      type: 'task',
      typeLabel: 'Task',
      title: 'Ship',
      board: null,
    };
    const one = thread({ card, elementId: 'th-1', itemId: 'plan-1' });
    const two = thread({ card, elementId: 'th-1', itemId: 'plan-2' });
    const { key, at } = settledOf(entryOf(one));
    expect(withoutSettled(data([one, two]), new Map([[key, at]])).threads).toEqual([]);
  });

  it('holds an action and a form by their own times', () => {
    const action = {
      app: 'liveplanner' as const,
      itemId: 'plan-1',
      itemTitle: 'Launch',
      itemTeamId: null,
      tabId: 'tab-1',
      tabName: 'Roadmap',
      elementId: 'el-1',
      actionId: 'a1',
      elementLabel: 'Box',
      name: 'Do it',
      description: '',
      status: 'open' as const,
      assigneeId: 'user_me',
      assigneeName: null,
      assignerId: 'user_ada',
      assignerName: null,
      teamId: null,
      card: null,
      createdAt: 1,
      updatedAt: 5,
    };
    const form = {
      app: 'liveplanner' as const,
      itemId: 'plan-1',
      itemTitle: 'Launch',
      itemTeamId: null,
      tabId: 'tab-f',
      heading: 'Sign-up',
      boardTabId: null,
      unseen: 2,
      latestAt: 7,
    };
    const all: InboxData = { threads: [], actions: [action], forms: [form] };
    const entries = inboxEntries(inboxSections(all, 'user_me'));
    const settled = new Map(entries.map((e) => [settledOf(e).key, settledOf(e).at]));
    expect(withoutSettled(all, settled)).toMatchObject({ actions: [], forms: [] });
  });
});
