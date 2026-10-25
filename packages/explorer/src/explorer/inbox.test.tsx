// The Inbox as a list and a reading pane: every kind of row newest first under its date divider, the filter bar and
// its counts (kept per viewer), choosing a row and reading it, the keys, the phone's list-to-pane-to-Back, the verbs
// the host can carry out (and only those, with Open always there), the host's This Browser rows, the re-read on
// returning to the tab, and the telemetry it reports.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IndexError,
  type CollabCard,
  type InboxAction,
  type InboxForm,
  type InboxThread,
} from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import type { InboxActions, InboxHost, InboxTarget, InboxVerb, ItemHref } from '../types';
import { Explorer, type ExplorerProps } from './Explorer';
import { INBOX_FILTER_KEY } from './InboxPane';
import {
  actionReason,
  bucketEdges,
  bucketOf,
  filterEntries,
  formReason,
  inboxEntries,
  inboxFilterCounts,
  inboxSections,
  threadReason,
} from './inbox/sections';

// Every part of the place in the address, so a test reads exactly what the pane hands the host.
const itemHref: ItemHref = (item, at) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(at ?? {})) if (v) q.set(k, String(v));
  const query = q.toString();
  return `https://${item.app}.app/open/${item.id}${query ? `?${query}` : ''}`;
};

function renderInbox(index: ReturnType<typeof createFakeIndex>, over: Partial<ExplorerProps> = {}) {
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'inbox' }}
      onNavigate={vi.fn()}
      itemHref={itemHref}
      onCreate={vi.fn()}
      viewerId="user_me"
      {...over}
    />,
  );
}

const NOW = Date.now();
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const card: CollabCard = {
  key: 12,
  type: 'bug',
  typeLabel: 'Bug',
  title: 'Login fails',
  board: { tabId: 'tab-b', elementId: 'board-1', title: 'Sprint', tabName: 'Board' },
};

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
  description: 'Somewhere with a screen',
  status: 'open',
  assigneeId: 'user_me',
  assigneeName: 'Me Person',
  assignerId: 'user_you',
  assignerName: 'Sam Lee',
  teamId: null,
  card: null,
  createdAt: 1,
  updatedAt: NOW - 10 * MIN,
  ...patch,
});

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
  commentCount: 3,
  latestText: 'Can we halve it?',
  latestAuthorName: 'Ada King',
  latestAuthorColor: '#f97316',
  card: null,
  mentionsYou: false,
  youCommented: true,
  onYourItem: false,
  firstAt: 1,
  latestAt: NOW - 20 * MIN,
  ...patch,
});

const form = (patch: Partial<InboxForm> = {}): InboxForm => ({
  app: 'liveplanner',
  itemId: 'plan-2',
  itemTitle: 'Intake',
  itemTeamId: null,
  tabId: 'form-tab',
  heading: 'Bug Report',
  boardTabId: 'board-tab',
  unseen: 2,
  latestAt: NOW - 3 * DAY,
  ...patch,
});

/** One of each kind: an action and a card for me, one I handed out, two threads, a form. */
function everyKind() {
  const index = createFakeIndex();
  index.inbox.actions.push(
    action({ actionId: 'a2', elementId: 'card-7', card, name: '', updatedAt: NOW - 5 * MIN }),
    action(),
    action({
      actionId: 'a3',
      assigneeId: 'user_bo',
      assigneeName: 'Bo Chen',
      assignerId: 'user_me',
      name: 'Chase Bo',
      updatedAt: NOW - 40 * DAY,
    }),
  );
  index.inbox.threads.push(
    thread(),
    thread({ elementId: 'card-7', card, mentionsYou: true, latestAt: NOW - 30 * MIN }),
  );
  index.inbox.forms.push(form());
  return index;
}

const options = () => screen.getAllByRole('option');
const listbox = () => screen.getByRole('listbox');
const titles = () => options().map((o) => o.querySelector('[data-inbox-title]')!.textContent);
const pane = () => screen.getByRole('region', { name: /./ });

// A phone: narrower than the Inbox's two columns.
function asPhone() {
  const mql = (query: string) => ({
    matches: query.includes('max-width: 767px'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal('matchMedia', mql);
  window.matchMedia = mql as unknown as typeof window.matchMedia;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error jsdom has none; a test that stubbed it takes it away again.
  delete window.matchMedia;
});

describe('the Inbox list', () => {
  it('lists every kind newest first under Today, Earlier This Week and Older, three lines a row', async () => {
    renderInbox(everyKind());
    await screen.findAllByRole('option');
    expect(titles()).toEqual([
      '#12Login fails',
      'Book the room',
      'Budget',
      '#12Login fails',
      'Bug Report',
      'Chase Bo',
    ]);
    const dividers = [...document.querySelectorAll('[data-inbox-bucket]')].map(
      (d) => d.textContent,
    );
    expect(dividers).toEqual(['Today', 'Earlier This Week', 'Older']);
    // Who, then what, then why and where: the card assigned to me by Sam.
    const first = options()[0]!;
    expect(first.querySelector('[data-inbox-who]')!.textContent).toBe('Sam Lee');
    expect(first.querySelector('[data-inbox-reason="assigned"]')!.textContent).toBe('To do');
    expect(first.textContent).toContain('Launch');
    expect(first.getAttribute('aria-label')).toBe(
      '#12 Login fails. To do. Sam Lee. In Launch, Board, Sprint',
    );
    // Work I handed out waits on its assignee, by first name.
    const chase = options()[5]!;
    expect(chase.querySelector('[data-inbox-reason="waiting"]')!.textContent).toBe('Waiting on Bo');
    expect(chase.querySelector('[data-inbox-who]')!.textContent).toBe('Bo Chen');
    // A form says how many responses are new.
    expect(options()[4]!.querySelector('[data-inbox-reason="responses"]')!.textContent).toBe(
      '2 new responses',
    );
    // The sidebar counts the work assigned to me: the action and the card.
    expect(screen.getByRole('treeitem', { name: 'Inbox (2)' })).toBeTruthy();
  });

  it('says why a row is there in short words, a mention first', () => {
    const t = {
      app: 'liveplanner' as const,
      mentionsYou: false,
      youCommented: false,
      onYourItem: false,
    };
    const label = (r: ReturnType<typeof threadReason>) => r?.label ?? null;
    expect(label(threadReason({ ...t, mentionsYou: true, onYourItem: true }))).toBe(
      'Mentioned you',
    );
    expect(label(threadReason({ ...t, onYourItem: true }))).toBe('On your plan');
    expect(label(threadReason({ ...t, app: 'livediagram', onYourItem: true }))).toBe(
      'On your canvas',
    );
    // In the thread: someone else wrote last, or I did.
    expect(
      label(threadReason({ ...t, youCommented: true, latestAuthorId: 'user_ada' }, 'user_me')),
    ).toBe('Replied to you');
    expect(
      label(threadReason({ ...t, youCommented: true, latestAuthorId: 'user_me' }, 'user_me')),
    ).toBe('You replied');
    expect(threadReason(t)).toBeNull();
    expect(actionReason({ assigneeName: 'Bo Chen' }, true).label).toBe('To do');
    expect(actionReason({ assigneeName: 'Bo Chen' }, false).label).toBe('Waiting on Bo');
    expect(actionReason({ assigneeName: null }, false).label).toBe('Waiting on a teammate');
    expect(formReason(1).label).toBe('1 new response');
    expect(formReason(4).label).toBe('4 new responses');
  });

  it('puts a row under its day: since midnight, the six days before, then older', () => {
    const at = new Date(2026, 9, 25, 9, 0).getTime();
    const edges = bucketEdges(at);
    expect(bucketOf(new Date(2026, 9, 25, 0, 1).getTime(), edges)).toBe('today');
    expect(bucketOf(new Date(2026, 9, 24, 23, 59).getTime(), edges)).toBe('week');
    expect(bucketOf(new Date(2026, 9, 19, 0, 1).getTime(), edges)).toBe('week');
    expect(bucketOf(new Date(2026, 9, 18, 23, 59).getTime(), edges)).toBe('older');
  });
});

describe('the filter bar', () => {
  it('shows each filter with its count, narrows the list, reports it and keeps it per viewer', async () => {
    const onTelemetry = vi.fn();
    const index = everyKind();
    const view = renderInbox(index, { inbox: { onTelemetry } });
    await screen.findAllByRole('option');
    const bar = within(screen.getByRole('group', { name: 'Inbox filters' }));
    expect(bar.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'All6',
      'My Actions2',
      'Assigned by Me1',
      'Comments2',
      'Form Responses1',
    ]);
    expect(bar.getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(bar.getByRole('button', { name: /^Comments/ }));
    expect(titles()).toEqual(['Budget', '#12Login fails']);
    expect(onTelemetry).toHaveBeenCalledWith('Changed', 'Comments');
    expect(screen.getByText('Comments: 2 rows')).toBeTruthy();
    expect(localStorage.getItem(`${INBOX_FILTER_KEY}:user_me`)).toBe('comments');

    fireEvent.click(bar.getByRole('button', { name: /^Assigned by Me/ }));
    expect(titles()).toEqual(['Chase Bo']);
    fireEvent.click(bar.getByRole('button', { name: /^Form Responses/ }));
    expect(titles()).toEqual(['Bug Report']);
    fireEvent.click(bar.getByRole('button', { name: /^My Actions/ }));
    expect(titles()).toEqual(['#12Login fails', 'Book the room']);

    // Back on the Inbox, the same viewer finds their choice; another viewer starts at All.
    view.unmount();
    renderInbox(index);
    await screen.findAllByRole('option');
    expect(titles()).toEqual(['#12Login fails', 'Book the room']);
    cleanupRender();
    renderInbox(index, { viewerId: 'user_other' });
    await screen.findAllByRole('option');
    expect(document.querySelector('[data-inbox-filter="all"]')!.getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('works beside the header’s app filter, which still decides what is read', async () => {
    const index = everyKind();
    index.inbox.threads.push(thread({ app: 'livediagram', itemId: 'canvas-1', elementId: 'x' }));
    renderInbox(index, { filter: 'app' });
    await screen.findAllByRole('option');
    expect(index.calls.find((c) => c.method === 'inbox')!.args[0]).toEqual({ app: 'liveplanner' });
    fireEvent.click(screen.getByRole('button', { name: /^Comments/ }));
    expect(titles()).toEqual(['Budget', '#12Login fails']);
  });

  it('offers All again when a filter holds nothing', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread());
    renderInbox(index);
    await screen.findAllByRole('option');
    fireEvent.click(screen.getByRole('button', { name: /^Form Responses/ }));
    expect(screen.getByText('Nothing in Form Responses')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(titles()).toEqual(['Budget']);
  });
});

function cleanupRender() {
  document.body.innerHTML = '';
}

describe('choosing a row', () => {
  it('reads the first row beside the list, and a row clicked; Open always goes to its place', async () => {
    renderInbox(everyKind());
    await screen.findAllByRole('option');
    expect(options()[0]!.getAttribute('aria-selected')).toBe('true');
    expect(pane().getAttribute('data-inbox-reader')).toBe('Card');
    const open = () => screen.getByRole('link', { name: 'Open in liveplanner' });
    expect(open().getAttribute('href')).toBe(
      'https://liveplanner.app/open/plan-1?tabId=tab-b&elementId=board-1&cardId=card-7',
    );

    const go = (i: number) => fireEvent.click(options()[i]!);
    go(1);
    expect(options()[1]!.getAttribute('aria-selected')).toBe('true');
    expect(within(pane()).getByRole('heading', { level: 2 }).textContent).toBe('Book the room');
    expect(pane().textContent).toContain('Sam assigned this to you');
    expect(pane().textContent).toContain('Somewhere with a screen');
    expect(open().getAttribute('href')).toBe(
      'https://liveplanner.app/open/plan-1?tabId=tab-1&elementId=el-1&open=action',
    );
    go(2);
    expect(open().getAttribute('href')).toBe(
      'https://liveplanner.app/open/plan-1?tabId=tab-1&elementId=el-2&open=comments',
    );
    // A thread with no host to read it shows the comment the index holds, and how many came before.
    expect(pane().textContent).toContain('Can we halve it?');
    expect(pane().textContent).toContain('2 earlier comments');
    go(4);
    expect(open().getAttribute('href')).toBe('https://liveplanner.app/open/plan-2?tabId=board-tab');
    // No verbs without a host: Open alone.
    expect(within(pane()).queryAllByRole('button')).toHaveLength(0);
  });

  it('reports the row a person opens in its app', async () => {
    const onTelemetry = vi.fn();
    renderInbox(everyKind(), { inbox: { onTelemetry } });
    await screen.findAllByRole('option');
    fireEvent.click(screen.getByRole('link', { name: 'Open in liveplanner' }));
    fireEvent.click(options()[4]!);
    fireEvent.click(screen.getByRole('link', { name: 'Open in liveplanner' }));
    expect(onTelemetry.mock.calls.filter((c) => c[0] === 'Selected')).toEqual([
      ['Selected', 'Card'],
      ['Selected', 'FormResponses'],
    ]);
  });
});

describe('the keys', () => {
  it('moves with j/k and the arrows, keeping focus on the list, and opens with Enter', async () => {
    const onTelemetry = vi.fn();
    renderInbox(everyKind(), { inbox: { onTelemetry } });
    await screen.findAllByRole('option');
    const list = listbox();
    list.focus();
    const active = () => document.getElementById(list.getAttribute('aria-activedescendant')!);
    expect(active()).toBe(options()[0]);
    fireEvent.keyDown(list, { key: 'j' });
    expect(active()).toBe(options()[1]);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(active()).toBe(options()[2]);
    fireEvent.keyDown(list, { key: 'k' });
    expect(active()).toBe(options()[1]);
    fireEvent.keyDown(list, { key: 'End' });
    expect(active()).toBe(options()[5]);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(active()).toBe(options()[5]);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(active()).toBe(options()[0]);
    // Moving never takes focus from the list.
    expect(document.activeElement).toBe(list);
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onTelemetry).toHaveBeenCalledWith('Selected', 'Card');
  });

  it('replies with r and resolves with e, where the page can', async () => {
    const actions = host(['reply', 'resolve']);
    const index = createFakeIndex();
    index.inbox.threads.push(thread());
    renderInbox(index, { inbox: { actions } });
    await screen.findAllByRole('option');
    const list = listbox();
    list.focus();
    fireEvent.keyDown(list, { key: 'r' });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Reply' }));
    list.focus();
    fireEvent.keyDown(list, { key: 'e' });
    await waitFor(() => expect(actions.resolve).toHaveBeenCalledTimes(1));
  });
});

describe('on a phone', () => {
  it('shows the list alone; a row opens the pane in its place, and Back, Esc or the browser’s Back return', async () => {
    asPhone();
    const push = vi.spyOn(window.history, 'pushState');
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderInbox(everyKind());
    await screen.findAllByRole('option');
    // Nothing chosen yet, and no pane.
    expect(document.querySelector('[data-inbox-reader]')).toBeNull();
    expect(options().every((o) => o.getAttribute('aria-selected') === 'false')).toBe(true);

    fireEvent.click(options()[1]!);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(pane().getAttribute('data-inbox-reader')).toBe('Action');
    expect(push).toHaveBeenCalledTimes(1);
    // The pane's title takes focus, so a screen reader starts there.
    expect(document.activeElement).toBe(within(pane()).getByRole('heading', { level: 2 }));

    fireEvent.click(screen.getByRole('button', { name: 'Back to Inbox' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(back).toHaveBeenCalledTimes(1);

    fireEvent.click(options()[2]!);
    fireEvent.keyDown(pane(), { key: 'Escape' });
    expect(screen.getByRole('listbox')).toBeTruthy();

    fireEvent.click(options()[4]!);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('listbox')).toBeTruthy();
    // The browser already stepped back: nothing more to undo.
    expect(back).toHaveBeenCalledTimes(2);
    push.mockRestore();
    back.mockRestore();
  });

  it('opens the pane from the keyboard too', async () => {
    asPhone();
    vi.spyOn(window.history, 'back').mockImplementation(() => {});
    renderInbox(everyKind());
    await screen.findAllByRole('option');
    const list = listbox();
    fireEvent.keyDown(list, { key: 'j' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(pane()).toBeTruthy();
  });
});

/** A host that offers `verbs` on every row and carries them out. */
function host(verbs: InboxVerb[], over: Partial<InboxActions> = {}) {
  return {
    offers: vi.fn((_t: InboxTarget) => verbs),
    reply: vi.fn(async () => {}),
    resolve: vi.fn(async () => {}),
    done: vi.fn(async () => {}),
    ...over,
  } satisfies InboxActions;
}

describe('the verbs', () => {
  it('offers only what the host can do for the row, and Open always', async () => {
    const index = everyKind();
    // The host can reply to and resolve threads, and mark nothing done.
    const actions = host([], {
      offers: vi.fn((t: InboxTarget) =>
        t.kind === 'Thread' ? (['reply', 'resolve'] as InboxVerb[]) : [],
      ),
    });
    renderInbox(index, { inbox: { actions } });
    await screen.findAllByRole('option');
    const verbs = () =>
      within(pane())
        .queryAllByRole('button')
        .map((b) => b.textContent);
    // The card: Open only.
    expect(verbs()).toEqual([]);
    expect(screen.getByRole('link', { name: 'Open in liveplanner' })).toBeTruthy();
    fireEvent.click(options()[2]!);
    expect(verbs()).toEqual(['ReplyR', 'ResolveE', 'Send']);
    expect(screen.getByRole('link', { name: 'Open in liveplanner' })).toBeTruthy();
    // A form is never asked about.
    fireEvent.click(options()[4]!);
    expect(verbs()).toEqual([]);
    expect(vi.mocked(actions.offers).mock.calls.map(([t]) => t.kind)).not.toContain(
      'FormResponses',
    );
    // An action can't reply: the host's say is kept to what fits the row.
    const doneOnly = host(['reply', 'done']);
    cleanupRender();
    renderInbox(index, { inbox: { actions: doneOnly } });
    await screen.findAllByRole('option');
    fireEvent.click(options()[1]!);
    expect(verbs()).toEqual(['Mark DoneE']);
  });

  it('resolves a thread: the row leaves the list, and it is reported and announced', async () => {
    const onTelemetry = vi.fn();
    const actions = host(['reply', 'resolve']);
    renderInbox(everyKind(), { inbox: { actions, onTelemetry } });
    await screen.findAllByRole('option');
    fireEvent.click(options()[2]!);
    fireEvent.click(within(pane()).getByRole('button', { name: /Resolve/ }));
    await waitFor(() => expect(titles()).not.toContain('Budget'));
    expect(vi.mocked(actions.resolve).mock.calls[0]![0]).toEqual({
      kind: 'Thread',
      app: 'liveplanner',
      itemId: 'plan-1',
      tabId: 'tab-1',
      elementId: 'el-2',
      actionId: null,
      local: false,
    });
    expect(onTelemetry).toHaveBeenCalledWith('Resolved', 'Thread');
    expect(screen.getByText('Resolved Budget')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Comments/ }).textContent).toBe('Comments1');
  });

  it('marks an action done where offered, and says so when it can’t', async () => {
    const onTelemetry = vi.fn();
    const actions = host(['done'], {
      done: vi.fn().mockRejectedValueOnce(new Error('no')).mockResolvedValue(undefined),
    });
    renderInbox(everyKind(), { inbox: { actions, onTelemetry } });
    await screen.findAllByRole('option');
    fireEvent.click(options()[1]!);
    fireEvent.click(within(pane()).getByRole('button', { name: /Mark Done/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(titles()).toContain('Book the room');
    fireEvent.click(within(pane()).getByRole('button', { name: /Mark Done/ }));
    await waitFor(() => expect(titles()).not.toContain('Book the room'));
    expect(onTelemetry).toHaveBeenCalledWith('Resolved', 'Action');
  });

  it('replies: the reply shows under the thread and is reported', async () => {
    const onTelemetry = vi.fn();
    const actions = host(['reply', 'resolve']);
    const index = createFakeIndex();
    index.inbox.threads.push(thread());
    renderInbox(index, { inbox: { actions, onTelemetry } });
    await screen.findAllByRole('option');
    const field = screen.getByRole('textbox', { name: 'Reply' });
    fireEvent.change(field, { target: { value: 'Halve it.' } });
    fireEvent.keyDown(field, { key: 'Enter', metaKey: true });
    await waitFor(() => expect(actions.reply).toHaveBeenCalledTimes(1));
    expect((vi.mocked(actions.reply).mock.calls[0] as unknown[])[1]).toBe('Halve it.');
    await screen.findByText('Halve it.');
    expect(onTelemetry).toHaveBeenCalledWith('Added', 'Reply');
    expect((field as HTMLTextAreaElement).value).toBe('');
    // The thread is still open: the row stays.
    expect(titles()).toEqual(['Budget']);
  });

  it('reads a thread only once the choice settles, once per thread, and keeps it', async () => {
    const loadThread = vi.fn(async (t: InboxTarget) => [
      { id: 'c1', authorName: 'Ada King', text: `First on ${t.elementId}`, at: NOW - DAY },
    ]);
    const index = createFakeIndex();
    for (let i = 0; i < 8; i++)
      index.inbox.threads.push(thread({ elementId: `e${i}`, latestAt: NOW - i * MIN }));
    renderInbox(index, { inbox: { actions: host([], { loadThread }) } });
    await screen.findAllByRole('option');
    const list = listbox();
    // Running down the list asks for nothing on the way.
    for (let i = 0; i < 7; i++) fireEvent.keyDown(list, { key: 'j' });
    await screen.findByText('First on e7');
    expect(loadThread.mock.calls.map(([t]) => t.elementId)).toEqual(['e7']);
    // Back and forth: e6 read once, e7 kept.
    fireEvent.keyDown(list, { key: 'k' });
    await screen.findByText('First on e6');
    fireEvent.keyDown(list, { key: 'j' });
    expect(screen.getByText('First on e7')).toBeTruthy();
    expect(loadThread).toHaveBeenCalledTimes(2);
  });

  it('shows the item’s thumbnail where the host draws one, read once the choice settles', async () => {
    const index = createFakeIndex({
      items: [{ ...(await import('../test/fakeClient')).makeItem(1, { id: 'plan-1' }) }],
    });
    index.inbox.threads.push(thread());
    renderInbox(index, {
      renderThumbnail: (item) => <span data-testid="thumb">{item.title}</span>,
    });
    expect(await screen.findByTestId('thumb')).toBeTruthy();
    expect(index.calls.filter((c) => c.method === 'getItem')).toHaveLength(1);
  });
});

describe('reading', () => {
  it('merges the host’s This Browser rows, and lists none of them when its store fails', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread({ latestAt: NOW - 2 * MIN }));
    const localRows = vi.fn().mockResolvedValue({
      actions: [],
      threads: [
        thread({ itemId: 'local-1', itemTitle: 'Offline plan', elementId: 'e9', latestAt: NOW }),
      ],
    });
    const { unmount } = renderInbox(index, { inbox: { localRows } });
    const local = await screen.findByRole('option', { name: /Offline plan/ });
    expect(local.querySelector('[data-this-browser]')!.textContent).toContain('This Browser');
    // Newest first, whichever side it came from.
    expect(options()[0]).toBe(local);
    expect(options()[1]!.querySelector('[data-this-browser]')).toBeNull();
    unmount();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderInbox(index, { inbox: { localRows: () => Promise.reject(new Error('idb')) } });
    await screen.findByRole('option', { name: /Budget/ });
    expect(screen.queryByText('Offline plan')).toBeNull();
    warn.mockRestore();
  });

  it('reads again on returning to the tab, keeping the list when that read fails', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const index = createFakeIndex();
    index.inbox.threads.push(thread());
    renderInbox(index);
    await screen.findByRole('option', { name: /Budget/ });
    const reads = () => index.calls.filter((c) => c.method === 'inbox').length;
    const first = reads();

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(reads()).toBe(first);

    now.mockReturnValue(1_100_000);
    index.inbox.forms.push(form());
    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await screen.findByRole('option', { name: /Bug Report/ });
    expect(reads()).toBe(first + 1);

    now.mockReturnValue(1_200_000);
    index.fail.set('inbox', new IndexError(500, 'unknown'));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(reads()).toBe(first + 2));
    expect(screen.getByRole('option', { name: /Budget/ })).toBeTruthy();
    expect(screen.queryByText('Couldn’t load your Inbox')).toBeNull();
    now.mockRestore();
  });

  it('reports a visit and a retry, and offers the help article when empty', async () => {
    const onTelemetry = vi.fn();
    const inbox: InboxHost = { onTelemetry, actionsHelpHref: 'https://help/actions' };
    const index = createFakeIndex();
    index.fail.set('inbox', new IndexError(500, 'unknown'));
    renderInbox(index, { inbox });
    expect(onTelemetry).toHaveBeenCalledWith('Opened');
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(onTelemetry).toHaveBeenCalledWith('Loaded', 'Retry');
    index.fail.delete('inbox');
    await screen.findByText('You’re all caught up');
    expect(screen.getByRole('link', { name: 'How actions work' }).getAttribute('href')).toBe(
      'https://help/actions',
    );
  });

  it('reports Opened once per visit, through the host hook it has then: not per read, filter or new host', async () => {
    const first = vi.fn();
    const index = createFakeIndex();
    const reads = () => index.calls.filter((c) => c.method === 'inbox').length;
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const view = renderInbox(index, { inbox: { onTelemetry: first } });
    await screen.findByText('You’re all caught up');
    const opened = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.filter((c) => c[0] === 'Opened');
    expect(opened(first)).toEqual([['Opened']]);
    const before = reads();
    now.mockReturnValue(1_000_000 + 60_000);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(reads()).toBe(before + 1));
    const second = vi.fn();
    const at = (over: Partial<ExplorerProps>) => (
      <Explorer
        app="liveplanner"
        client={index.client}
        view={{ kind: 'inbox' }}
        onNavigate={vi.fn()}
        itemHref={itemHref}
        onCreate={vi.fn()}
        viewerId="user_me"
        {...over}
      />
    );
    view.rerender(at({ inbox: { onTelemetry: second }, filter: 'all', onFilterChange: vi.fn() }));
    expect(opened(first)).toHaveLength(1);
    expect(opened(second)).toHaveLength(0);
    view.rerender(at({ inbox: { onTelemetry: second }, view: { kind: 'trash' } }));
    view.rerender(at({ inbox: { onTelemetry: second } }));
    expect(opened(first)).toHaveLength(1);
    expect(opened(second)).toEqual([['Opened']]);
    now.mockRestore();
  });

  it('builds, counts and filters a worst-case Inbox in budget', () => {
    const many = 1000;
    const data = {
      actions: Array.from({ length: many }, (_, i) =>
        action({
          actionId: `a${i}`,
          assigneeId: i % 2 ? 'user_me' : 'user_x',
          assignerId: 'user_me',
          updatedAt: i,
        }),
      ),
      threads: Array.from({ length: many }, (_, i) => thread({ elementId: `e${i}`, latestAt: i })),
      forms: Array.from({ length: many }, (_, i) => form({ tabId: `f${i}`, latestAt: i })),
      timelineNew: 0,
    };
    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      const entries = inboxEntries(inboxSections(data, 'user_me'));
      inboxFilterCounts(entries);
      filterEntries(entries, 'comments');
    }
    const per = (performance.now() - start) / 20;
    console.info(`inbox: 3,000 rows built, counted and filtered in ${per.toFixed(1)} ms`);
    // Measured at about 4 ms on an idle laptop; the budget leaves room for a loaded CI box.
    expect(per).toBeLessThan(30);
  });
});
