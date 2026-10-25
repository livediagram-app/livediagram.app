// The Inbox's rows and sections: actions and cards assigned to the person, forms with new responses, element and
// card threads with why they are there, the host's This Browser rows, each row's link, the re-read on returning to
// the tab, and the telemetry it reports.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  IndexError,
  type CollabCard,
  type InboxAction,
  type InboxForm,
  type InboxThread,
} from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import type { InboxHost, ItemHref } from '../types';
import { Explorer, type ExplorerProps } from './Explorer';
import { actionReason, formReason, inboxSections, threadReason } from './inbox/sections';

// Every part of the place in the address, so a test reads exactly what a row hands the host.
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
  updatedAt: 2,
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
  latestAt: 5,
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
  latestAt: 9,
  ...patch,
});

describe('the Inbox', () => {
  it('lists actions and cards for me, forms, and threads, each linking to its place', async () => {
    const index = createFakeIndex();
    index.inbox.actions.push(
      // The index's order: newest first.
      action({ actionId: 'a2', elementId: 'card-7', card, name: '', updatedAt: 4 }),
      action(),
      action({
        actionId: 'a3',
        assigneeId: 'user_bo',
        assigneeName: 'Bo',
        assignerId: 'user_me',
        name: 'Chase Bo',
      }),
    );
    index.inbox.threads.push(
      thread(),
      thread({ elementId: 'card-7', card, mentionsYou: true, latestAt: 3 }),
    );
    index.inbox.forms.push(form());
    renderInbox(index);

    await screen.findByRole('link', { name: /Book the room/ });
    const sections = screen.getAllByRole('region').map((s) => s.getAttribute('aria-label'));
    expect(sections).toEqual([
      'Assigned to You',
      'Assigned by You',
      'Form Responses',
      'Open Comment Threads',
    ]);
    const forMe = within(screen.getByRole('region', { name: 'Assigned to You' }));
    expect(forMe.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([
      'https://liveplanner.app/open/plan-1?tabId=tab-b&elementId=board-1&cardId=card-7',
      'https://liveplanner.app/open/plan-1?tabId=tab-1&elementId=el-1&open=action',
    ]);
    // The card reads as its number, title, type and board, assigned to me by Sam.
    const cardRow = forMe.getAllByRole('link')[0]!;
    expect(cardRow.querySelector('[data-inbox-title]')!.textContent).toBe('#12Login fails');
    expect(cardRow.querySelector('[data-inbox-card-type="bug"]')!.textContent).toBe('Bug');
    expect(cardRow.getAttribute('aria-label')).toBe(
      '#12 Login fails. Assigned to you by Sam Lee. Bug. In Launch, Board, Sprint',
    );
    // The action: its note, where it is, and who assigned it, on Sam's avatar.
    const actionRow = forMe.getAllByRole('link')[1]!;
    expect(actionRow.querySelector('[data-inbox-detail]')!.textContent).toBe(
      'Somewhere with a screen',
    );
    expect(actionRow.getAttribute('aria-label')).toBe(
      'Book the room. Assigned to you by Sam Lee. In Launch, Roadmap, Kick-off',
    );
    expect(actionRow.querySelector('[data-inbox-reason="assigned"]')!.textContent).toBe(
      'Assigned to you',
    );
    expect(actionRow.querySelector('[data-inbox-avatar]')!.textContent).toBe('SL');
    // The note and the time describe the row; the time is a <time> with its instant.
    const described = actionRow.getAttribute('aria-describedby')!.split(' ');
    expect(described.map((id) => document.getElementById(id)?.tagName)).toEqual(['SPAN', 'TIME']);
    expect(actionRow.querySelector('time')!.getAttribute('datetime')).toBe(
      new Date(2).toISOString(),
    );
    // Work I handed out waits on its assignee, on their avatar.
    const chase = screen.getByRole('link', { name: /Chase Bo/ });
    expect(chase.getAttribute('href')).toContain('open=action');
    expect(chase.querySelector('[data-inbox-reason="waiting"]')!.textContent).toBe('Waiting on Bo');
    expect(chase.querySelector('[data-inbox-avatar]')!.textContent).toBe('B');

    const formRow = screen.getByRole('link', { name: /Bug Report/ });
    expect(formRow.getAttribute('href')).toBe(
      'https://liveplanner.app/open/plan-2?tabId=board-tab',
    );
    expect(formRow.querySelector('[data-inbox-reason="responses"]')!.textContent).toBe(
      '2 new responses',
    );

    const threads = within(screen.getByRole('region', { name: 'Open Comment Threads' }));
    const [elementThread, cardThread] = threads.getAllByRole('link');
    expect(elementThread!.getAttribute('href')).toBe(
      'https://liveplanner.app/open/plan-1?tabId=tab-1&elementId=el-2&open=comments',
    );
    // The latest comment, quoted under its author, and the thread's comment count.
    expect(elementThread!.querySelector('[data-inbox-detail]')!.textContent).toBe(
      'Ada King: Can we halve it?',
    );
    expect(elementThread!.querySelector('[data-inbox-comments]')!.textContent).toBe('3');
    expect(elementThread!.getAttribute('aria-label')).toBe(
      'Budget. You replied. 3 comments. In Launch, Roadmap',
    );
    const disc = elementThread!.querySelector<HTMLElement>('[data-inbox-avatar]')!;
    expect(disc.textContent).toBe('AK');
    // Their orange, darkened in its own hue until the white initials read at AA (ui/avatar-fill.ts).
    expect(disc.style.backgroundColor).toBe('rgb(187, 86, 17)');
    expect(cardThread!.getAttribute('href')).toContain('cardId=card-7');
    expect(cardThread!.querySelector('[data-inbox-reason="mention"]')!.textContent).toBe(
      'Mentioned you',
    );

    // The sidebar counts the work assigned to me: the action and the card, not the forms or threads.
    expect(screen.getByRole('treeitem', { name: 'Inbox (2)' })).toBeTruthy();
  });

  it('says why a row is there: a mention first, then the item being theirs, then a reply', () => {
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
    expect(label(threadReason({ ...t, onYourItem: true, youCommented: true }))).toBe('You replied');
    expect(label(threadReason({ ...t, app: 'livediagram', onYourItem: true }))).toBe(
      'On your canvas',
    );
    expect(threadReason(t)).toBeNull();
    expect(actionReason({ assigneeName: 'Bo' }, true).label).toBe('Assigned to you');
    expect(actionReason({ assigneeName: 'Bo' }, false).label).toBe('Waiting on Bo');
    expect(actionReason({ assigneeName: null }, false).label).toBe('Waiting on a teammate');
    expect(formReason(1).label).toBe('1 new response');
    expect(formReason(4).label).toBe('4 new responses');
  });

  it('merges the host’s This Browser rows, and lists none of them when its store fails', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread({ latestAt: 1 }));
    const localRows = vi.fn().mockResolvedValue({
      actions: [],
      threads: [
        thread({ itemId: 'local-1', itemTitle: 'Offline plan', elementId: 'e9', latestAt: 8 }),
      ],
    });
    const { unmount } = renderInbox(index, { inbox: { localRows } });
    const local = await screen.findByRole('link', { name: /Offline plan/ });
    expect(local.querySelector('[data-this-browser]')!.textContent).toBe('This Browser');
    const threads = within(screen.getByRole('region', { name: 'Open Comment Threads' }));
    // Newest first, whichever side it came from.
    expect(threads.getAllByRole('link')[0]).toBe(local);
    expect(threads.getAllByRole('link')[1]!.querySelector('[data-this-browser]')).toBeNull();
    unmount();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderInbox(index, { inbox: { localRows: () => Promise.reject(new Error('idb')) } });
    await screen.findByRole('link', { name: /Budget/ });
    expect(screen.queryByText('Offline plan')).toBeNull();
    warn.mockRestore();
  });

  it('reads again on returning to the tab, keeping the list when that read fails', async () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    const index = createFakeIndex();
    index.inbox.threads.push(thread());
    renderInbox(index);
    await screen.findByRole('link', { name: /Budget/ });
    const reads = () => index.calls.filter((c) => c.method === 'inbox').length;
    const first = reads();

    // Too soon: the focus and visibility events of one return are one read, and a quick flick is none.
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
    await screen.findByRole('link', { name: /Bug Report/ });
    expect(reads()).toBe(first + 1);

    now.mockReturnValue(1_200_000);
    index.fail.set('inbox', new IndexError(500, 'unknown'));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(reads()).toBe(first + 2));
    expect(screen.getByRole('link', { name: /Budget/ })).toBeTruthy();
    expect(screen.queryByText('Couldn’t load your Inbox')).toBeNull();
    now.mockRestore();
  });

  it('reports a visit, a row followed and a retry, and offers the help article when empty', async () => {
    const onTelemetry = vi.fn();
    const host: InboxHost = { onTelemetry, actionsHelpHref: 'https://help/actions' };
    const index = createFakeIndex();
    index.fail.set('inbox', new IndexError(500, 'unknown'));
    renderInbox(index, { inbox: host });
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
    const props = { inbox: { onTelemetry: first } };
    const view = renderInbox(index, props);
    await screen.findByText('You’re all caught up');
    const opened = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.filter((c) => c[0] === 'Opened');
    expect(opened(first)).toEqual([['Opened']]);
    // Returning to the tab re-reads the Inbox: not a visit.
    const before = reads();
    now.mockReturnValue(1_000_000 + 60_000);
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(reads()).toBe(before + 1));
    // Another filter, and a host that hands a new hook: still the same visit.
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
    // Away and back: a second visit, reported through the hook the host hands now.
    view.rerender(at({ inbox: { onTelemetry: second }, view: { kind: 'trash' } }));
    view.rerender(at({ inbox: { onTelemetry: second } }));
    expect(opened(first)).toHaveLength(1);
    expect(opened(second)).toEqual([['Opened']]);
    now.mockRestore();
  });

  it('reports the row a person follows', async () => {
    const onTelemetry = vi.fn();
    const index = createFakeIndex();
    index.inbox.actions.push(action({ elementId: 'card-7', card }));
    index.inbox.forms.push(form());
    renderInbox(index, { inbox: { onTelemetry } });
    fireEvent.click(await screen.findByRole('link', { name: /Login fails/ }));
    fireEvent.click(screen.getByRole('link', { name: /Bug Report/ }));
    expect(onTelemetry.mock.calls.filter((c) => c[0] === 'Selected')).toEqual([
      ['Selected', 'Card'],
      ['Selected', 'FormResponses'],
    ]);
  });

  it('splits sections in budget at a worst-case Inbox', () => {
    const many = 5000;
    const data = {
      actions: Array.from({ length: many }, (_, i) =>
        action({
          actionId: `a${i}`,
          assigneeId: i % 2 ? 'user_me' : 'user_x',
          assignerId: 'user_me',
        }),
      ),
      threads: Array.from({ length: many }, (_, i) => thread({ elementId: `e${i}` })),
      forms: Array.from({ length: many }, (_, i) => form({ tabId: `f${i}` })),
      timelineNew: 0,
    };
    const start = performance.now();
    for (let i = 0; i < 20; i++) inboxSections(data, 'user_me');
    const per = (performance.now() - start) / 20;
    expect(per).toBeLessThan(10);
  });
});
