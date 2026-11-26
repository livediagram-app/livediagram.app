// The Inbox's reading (liveworkspace/docs/specs/004-index/inbox-reading.md): read and unread kept by the index, a row
// read after a moment in the pane or on a verb, u and Mark All Read, the count of unread rows that wait on the reader,
// AI comments marked with their assistant and asking only when they ask, and a Viewer offered no Reply or Resolve.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  threadKey,
  type InboxAction,
  type InboxThread,
  type Level,
} from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../../test/fakeClient';
import type { InboxActions, InboxComment, InboxTarget, InboxVerb } from '../../types';
import { Explorer, type ExplorerProps } from '../Explorer';
import { READ_AFTER_MS } from '../InboxPane';
import { inboxCount } from './inbox-count';

const NOW = new Date(2026, 9, 28, 12, 0).getTime();
const MIN = 60_000;

const thread = (patch: Partial<InboxThread> = {}): InboxThread => ({
  app: 'liveplanner',
  itemId: 'plan-1',
  itemTitle: 'Launch',
  itemTeamId: null,
  tabId: 'tab-1',
  tabName: 'Roadmap',
  elementId: 'el-2',
  elementLabel: 'Budget',
  resolved: false,
  commentCount: 2,
  latestText: 'Can we halve it?',
  latestAuthorName: 'Ada King',
  latestAuthorColor: '#f97316',
  latestAuthorId: 'user_ada',
  card: null,
  mentionsYou: true,
  youCommented: true,
  onYourItem: false,
  firstAt: 1,
  latestAt: NOW - 20 * MIN,
  ...patch,
});

const action = (patch: Partial<InboxAction> = {}): InboxAction => ({
  app: 'liveplanner',
  itemId: 'plan-1',
  itemTitle: 'Launch',
  itemTeamId: null,
  tabId: 'tab-1',
  tabName: 'Roadmap',
  elementId: 'el-1',
  actionId: 'a1',
  elementLabel: 'Kick-off',
  name: 'Book the room',
  description: '',
  status: 'open',
  assigneeId: 'user_me',
  assigneeName: 'Me',
  assignerId: 'user_sam',
  assignerName: 'Sam Lee',
  teamId: null,
  card: null,
  createdAt: 1,
  updatedAt: NOW - 10 * MIN,
  ...patch,
});

function withItem(access: Level = 'edit') {
  const index = createFakeIndex({ items: [makeItem(1, { id: 'plan-1', access })] });
  index.inbox.read = { before: 0, at: {} };
  return index;
}

const host = (over: Partial<InboxActions> = {}): InboxActions => ({
  offers: (t: InboxTarget) =>
    t.kind === 'Thread' ? (['reply', 'resolve'] as InboxVerb[]) : ([] as InboxVerb[]),
  reply: vi.fn(async () => {}),
  resolve: vi.fn(async () => {}),
  ...over,
});

function renderInbox(index: ReturnType<typeof createFakeIndex>, over: Partial<ExplorerProps> = {}) {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'inbox' }}
      onNavigate={vi.fn()}
      itemHref={(item) => `https://${item.app}.app/open/${item.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      {...over}
    />,
  );
}

const marks = (index: ReturnType<typeof createFakeIndex>) =>
  index.calls.filter((c) => c.method === 'markInbox').map((c) => c.args[0]);
const pane = () => document.querySelector('[data-inbox-reader]') as HTMLElement;
const list = () => screen.getByRole('listbox', { name: /^Inbox/ });
const options = () => within(list()).getAllByRole('option');
// The list and the pane beside it, once the Inbox has read.
async function ready() {
  await screen.findByRole('listbox', { name: /^Inbox/ });
  await waitFor(() => expect(pane()).toBeTruthy());
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe('read and unread', () => {
  it('reads a row after a moment in the pane, never on a glance, and keeps it with the index', async () => {
    const index = withItem();
    index.inbox.threads.push(thread());
    index.inbox.actions.push(action());
    renderInbox(index, { inbox: { actions: host() } });
    await ready();
    // Both unread: a dot each.
    expect(options().map((o) => o.hasAttribute('data-inbox-unread'))).toEqual([true, true]);
    // The first row shows beside the list: under a second, still unread.
    act(() => void vi.advanceTimersByTime(READ_AFTER_MS - 100));
    expect(marks(index)).toEqual([]);
    act(() => void vi.advanceTimersByTime(200));
    await waitFor(() =>
      expect(marks(index)).toEqual([
        { read: [{ key: 'a:liveplanner:plan-1:a1', at: NOW - 10 * MIN }] },
      ]),
    );
    expect(options()[0]!.hasAttribute('data-inbox-unread')).toBe(false);
    expect(options()[1]!.hasAttribute('data-inbox-unread')).toBe(true);
  });

  it('marks the chosen row unread and read again with u and the pane’s button, and reports it', async () => {
    const onTelemetry = vi.fn();
    const index = withItem();
    const t = thread();
    index.inbox.threads.push(t);
    index.inbox.read = { before: 0, at: { [threadKey(t)]: t.latestAt } };
    renderInbox(index, { inbox: { actions: host(), onTelemetry } });
    await ready();
    expect(options()[0]!.hasAttribute('data-inbox-unread')).toBe(false);
    const toggle = await within(pane()).findByRole('button', { name: 'Mark Unread' });
    fireEvent.click(toggle);
    expect(options()[0]!.hasAttribute('data-inbox-unread')).toBe(true);
    expect(marks(index).at(-1)).toEqual({ unread: [threadKey(t)] });
    expect(onTelemetry).toHaveBeenCalledWith('Changed', 'Unread');
    // u reads it again.
    fireEvent.keyDown(list(), { key: 'u' });
    expect(options()[0]!.hasAttribute('data-inbox-unread')).toBe(false);
    expect(marks(index).at(-1)).toEqual({ read: [{ key: threadKey(t), at: t.latestAt }] });
    expect(onTelemetry).toHaveBeenCalledWith('Changed', 'Read');
  });

  it('reads every row with Mark All Read, which then has nothing to do', async () => {
    const onTelemetry = vi.fn();
    const index = withItem();
    index.inbox.threads.push(thread());
    index.inbox.actions.push(action());
    renderInbox(index, { inbox: { onTelemetry } });
    await ready();
    const button = screen.getByRole('button', { name: 'Mark All Read' });
    fireEvent.click(button);
    expect(options().some((o) => o.hasAttribute('data-inbox-unread'))).toBe(false);
    expect(marks(index)).toEqual([{ all: true }]);
    expect(onTelemetry).toHaveBeenCalledWith('Changed', 'ReadAll');
    const done = await screen.findByRole('button', { name: 'Everything is read' });
    expect(done.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(done);
    expect(marks(index)).toHaveLength(1);
  });

  it('reads a row a verb was done on at once', async () => {
    const index = withItem();
    const t = thread();
    index.inbox.threads.push(t);
    const actions = host();
    renderInbox(index, { inbox: { actions } });
    await ready();
    const field = await within(pane()).findByRole('textbox', { name: 'Reply' });
    fireEvent.change(field, { target: { value: 'Yes' } });
    fireEvent.keyDown(field, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(actions.reply).toHaveBeenCalled());
    await waitFor(() =>
      expect(marks(index)).toEqual([{ read: [{ key: threadKey(t), at: t.latestAt }] }]),
    );
  });
});

describe('the count', () => {
  it('counts the rows that wait on the reader while they are unread', () => {
    const t = thread();
    const a = action();
    const data = { threads: [t], actions: [a], forms: [] };
    expect(inboxCount(data, 'user_me')).toBe(2);
    expect(
      inboxCount({ ...data, read: { before: 0, at: { [threadKey(t)]: t.latestAt } } }, 'user_me'),
    ).toBe(1);
    // A change after it was read counts again; Mark All Read reads both.
    expect(
      inboxCount(
        { ...data, read: { before: 0, at: { [threadKey(t)]: t.latestAt - 1 } } },
        'user_me',
      ),
    ).toBe(2);
    expect(inboxCount({ ...data, read: { before: NOW, at: {} } }, 'user_me')).toBe(0);
  });

  it('counts an agent’s ask, and not a thread an agent only remarked in', () => {
    const asks = thread({ mentionsYou: false, asks: true, latestAgent: 'Claude' });
    const remark = thread({ elementId: 'el-3', mentionsYou: false, latestAgent: 'Claude' });
    expect(inboxCount({ threads: [asks, remark], actions: [], forms: [] }, 'user_me')).toBe(1);
  });
});

describe('AI comments', () => {
  it('names the assistant with an AI mark, says when it asks, and shows its comments as the assistant’s', async () => {
    const index = withItem();
    index.inbox.threads.push(
      thread({ mentionsYou: false, asks: true, latestAgent: 'Claude', latestAuthorId: 'user_me' }),
    );
    const loadThread = vi.fn(async (): Promise<InboxComment[]> => [
      { id: 'c1', authorName: 'Ada King', text: 'What date?', at: NOW - 30 * MIN },
      {
        id: 'c2',
        authorName: 'Me',
        mine: true,
        ai: true,
        agent: 'Claude',
        needsResponse: true,
        text: 'Friday or Monday?',
        at: NOW - 20 * MIN,
      },
    ]);
    renderInbox(index, { inbox: { actions: host({ loadThread }) } });
    await ready();
    const row = options()[0]!;
    expect(row.querySelector('[data-inbox-who]')!.textContent).toBe('Claude');
    expect(row.querySelector('[data-inbox-ai]')!.textContent).toBe('AIfor you');
    expect(row.querySelector('[data-inbox-reason="ask"]')!.textContent).toBe('Needs your response');
    expect(row.getAttribute('aria-label')).toContain('Claude, AI, for you');
    await waitFor(() => expect(pane().querySelectorAll('[data-inbox-comment]')).toHaveLength(2));
    const ai = pane().querySelector('[data-inbox-comment="ai"]') as HTMLElement;
    expect(ai.textContent).toContain('Claude');
    expect(ai.textContent).not.toContain('You');
    expect(ai.querySelector('[data-inbox-asks]')!.textContent).toBe('Asks for a response');
  });
});

describe('share roles', () => {
  it('offers a Viewer no Reply or Resolve, and says so; a Participant both', async () => {
    const viewer = withItem('view');
    viewer.inbox.threads.push(thread());
    renderInbox(viewer, { inbox: { actions: host() } });
    await ready();
    expect(
      await within(document.body).findByText(/You can view this plan but not reply or resolve/),
    ).toBeTruthy();
    expect(within(pane()).queryByRole('button', { name: /Reply/ })).toBeNull();
    expect(within(pane()).queryByRole('button', { name: /Resolve/ })).toBeNull();
    expect(within(pane()).queryByRole('textbox', { name: 'Reply' })).toBeNull();
    // Open in the app stays.
    expect(within(pane()).getByRole('link', { name: /Open in liveplanner/ })).toBeTruthy();
    cleanup();

    const participant = withItem('participate');
    participant.inbox.threads.push(thread());
    renderInbox(participant, { inbox: { actions: host() } });
    await ready();
    expect(await within(pane()).findByRole('button', { name: /Resolve/ })).toBeTruthy();
    expect(within(pane()).getByRole('textbox', { name: 'Reply' })).toBeTruthy();
    expect(document.querySelector('[data-inbox-view-only]')).toBeNull();
  });
});
