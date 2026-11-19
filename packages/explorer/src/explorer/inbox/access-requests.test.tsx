// Request Access in the Inbox (liveworkspace/docs/specs/004-index/request-access.md "In the Inbox"; Work Tracker 1137,
// 1308): an open request on an item the reader manages is a row that counts, with its own filter while there is one;
// its pane quotes the note and shares at the default level, at a chosen one, or declines, through the index. The
// index lists a request only to its item's managers; the reader's own request is never theirs to answer.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError, type InboxAccessRequest } from '@liveworkspace/index-client';
import { createFakeIndex } from '../../test/fakeClient';
import type { InboxData } from '../../data/useInbox';
import { noticeRows, requestRowHref } from '../../inbox-notices/rows';
import { Explorer, type ExplorerProps } from '../Explorer';
import { grantLevel } from './AccessRequestPane';
import {
  inboxBadge,
  inboxEntries,
  inboxFilterCounts,
  inboxSections,
  inboxTotal,
  settledOf,
  shownFilters,
  withoutSettled,
} from './sections';

const NOW = new Date(2026, 10, 19, 12, 0).getTime();
const MIN = 60_000;

const request = (patch: Partial<InboxAccessRequest> = {}): InboxAccessRequest => ({
  id: 'req_1',
  app: 'liveplanner',
  itemId: 'plan-1',
  itemTitle: 'Launch Plan',
  itemTeamId: null,
  requesterId: 'user_ana',
  requesterName: 'Ana Diaz',
  note: 'I am on the launch team',
  askedAt: NOW - 20 * MIN,
  ...patch,
});

const data = (accessRequests: InboxAccessRequest[]): InboxData => ({
  threads: [],
  actions: [],
  forms: [],
  accessRequests,
});

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

const live = () => document.querySelector('[data-inbox-live]')?.textContent ?? '';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('the model', () => {
  it('lists each open request under its key, counted in the badge and the total', () => {
    const d = data([request(), request({ id: 'req_2', askedAt: NOW - MIN })]);
    const entries = inboxEntries(inboxSections(d, 'user_me'));
    expect(entries.map((e) => e.key)).toEqual(['r:req_2', 'r:req_1']);
    expect(entries[0]!.kind).toBe('AccessRequest');
    expect(inboxBadge(d, 'user_me')).toBe(2);
    expect(inboxTotal(d, 'user_me')).toBe(2);
  });

  it('never lists the reader’s own request', () => {
    const d = data([request({ requesterId: 'user_me' })]);
    expect(inboxEntries(inboxSections(d, 'user_me'))).toEqual([]);
    expect(inboxBadge(d, 'user_me')).toBeUndefined();
    // Signed out (no viewer id) lists what the read holds, as for every other row.
    expect(inboxSections(d, null).requests).toHaveLength(1);
  });

  it('reads an Inbox from an index without requests as none', () => {
    const d: InboxData = { threads: [], actions: [], forms: [] };
    expect(inboxSections(d, 'user_me').requests).toEqual([]);
    expect(withoutSettled(d, new Map([['r:req_1', 1]]))).toEqual(d);
  });

  it('offers Access Requests only while there is one, or it is the choice', () => {
    const none = inboxFilterCounts([]);
    expect(shownFilters(none, 'all')).not.toContain('requests');
    expect(shownFilters(none, 'requests')).toContain('requests');
    const one = inboxFilterCounts(inboxEntries(inboxSections(data([request()]), 'user_me')));
    expect(one.requests).toBe(1);
    expect(shownFilters(one, 'all')).toContain('requests');
  });

  it('keeps a request answered here out until a read lists it changed', () => {
    const d = data([request()]);
    const [entry] = inboxEntries(inboxSections(d, 'user_me'));
    const settled = settledOf(entry!);
    expect(settled).toEqual({ key: 'r:req_1', at: NOW - 20 * MIN });
    const map = new Map([[settled.key, settled.at]]);
    expect(withoutSettled(d, map).accessRequests).toEqual([]);
    const asked = data([request({ askedAt: NOW })]);
    expect(withoutSettled(asked, map).accessRequests).toHaveLength(1);
  });

  it('shares at Viewer where the app offers it, else the app’s default', () => {
    expect(grantLevel('liveplanner')).toBe('view');
    expect(grantLevel('livehuddle')).toBe('participate');
  });
});

describe('an editor’s notice of a request', () => {
  it('opens the Inbox at its row, on liveworkspace.app for an app with no Inbox', () => {
    const rows = noticeRows(
      { threads: [], actions: [], forms: [], accessRequests: [request()] },
      'user_me',
      'liveplanner',
    );
    expect(rows[0]!.href).toBe('/explorer/inbox?at=r%3Areq_1');
    expect(requestRowHref('livehuddle', 'r:x', 'liveplanner')).toMatch(
      /liveworkspace.*\/explorer\/inbox\?at=r%3Ax$/,
    );
  });
});

describe('the row and the pane', () => {
  it('says who asks, why it is here and the item, and quotes the note', async () => {
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request());
    renderInbox(index);
    const row = await screen.findByRole('option', { name: /Asked for access/ });
    expect(row.getAttribute('data-inbox-key')).toBe('r:req_1');
    expect(within(row).getByText('Ana Diaz').className).toContain('font-semibold');
    expect(within(row).getByText('Wants access')).toBeTruthy();
    const pane = document.querySelector('[data-inbox-reader="AccessRequest"]') as HTMLElement;
    expect(within(pane).getByText('Asked for access')).toBeTruthy();
    expect(within(pane).getByText('Ana wants access to Launch Plan')).toBeTruthy();
    expect(within(pane).getByText('I am on the launch team')).toBeTruthy();
    expect(within(pane).getByText(/Sharing makes a pass for Ana in Share/)).toBeTruthy();
    expect(screen.getByRole('option', { name: /Access Requests \(1\)/ })).toBeTruthy();
  });

  it('says Someone and that no note was left', async () => {
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request({ requesterName: null, note: null }));
    renderInbox(index);
    const row = await screen.findByRole('option', { name: /Asked for access/ });
    expect(within(row).getByText('Someone')).toBeTruthy();
    expect(screen.getByText('They left no note.')).toBeTruthy();
    expect(screen.getByText(/makes a pass for them/)).toBeTruthy();
  });

  it('shares at Viewer in one press, and the row leaves', async () => {
    const onTelemetry = vi.fn();
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request());
    renderInbox(index, { inbox: { onTelemetry } });
    fireEvent.click(await screen.findByRole('button', { name: /Share as Viewer/ }));
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: /Asked for access/ })).toBeNull(),
    );
    expect(index.calls.find((c) => c.method === 'grantAccessRequest')!.args).toEqual([
      'plan-1',
      'req_1',
      { level: 'view' },
    ]);
    expect(onTelemetry).toHaveBeenCalledWith('Resolved', 'AccessGranted');
    expect(live()).toBe('Shared Launch Plan with Ana as Viewer');
  });

  it('shares with e from the keyboard', async () => {
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request());
    renderInbox(index);
    await screen.findByRole('option', { name: /Asked for access/ });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'e' });
    await waitFor(() => expect(index.count('grantAccessRequest')).toBe(1));
  });

  it('shares at a level chosen from the menu, the default ticked', async () => {
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request());
    renderInbox(index);
    fireEvent.click(await screen.findByRole('button', { name: 'Choose the level to share at' }));
    const menu = screen.getByRole('menu', { name: 'Share at' });
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((i) => i.getAttribute('data-inbox-access-level'))).toEqual([
      'edit',
      'participate',
      'view',
    ]);
    expect(within(items[2]!).getByText('(the default)')).toBeTruthy();
    fireEvent.click(items[0]!);
    await waitFor(() => expect(index.count('grantAccessRequest')).toBe(1));
    expect(index.calls.find((c) => c.method === 'grantAccessRequest')!.args[2]).toEqual({
      level: 'edit',
    });
    expect(live()).toBe('Shared Launch Plan with Ana as Editor');
  });

  it('offers a space’s levels, Participant first by default', async () => {
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request({ app: 'livehuddle', itemTitle: '' }));
    renderInbox(index, { filter: 'all' });
    fireEvent.click(await screen.findByRole('button', { name: 'Choose the level to share at' }));
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.map((i) => i.getAttribute('data-inbox-access-level'))).toEqual([
      'edit',
      'participate',
    ]);
    expect(screen.getByRole('button', { name: /Share as Participant/ })).toBeTruthy();
  });

  it('declines in one press, telling the requester nothing, and the row leaves', async () => {
    const onTelemetry = vi.fn();
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request());
    renderInbox(index, { inbox: { onTelemetry } });
    fireEvent.click(await screen.findByRole('button', { name: /Decline/ }));
    await waitFor(() => expect(index.count('declineAccessRequest')).toBe(1));
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: /Asked for access/ })).toBeNull(),
    );
    expect(onTelemetry).toHaveBeenCalledWith('Resolved', 'AccessDeclined');
    expect(live()).toBe('Declined Ana’s request');
  });

  it('says a request with no name was declined plainly', async () => {
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request({ requesterName: '' }));
    renderInbox(index);
    fireEvent.click(await screen.findByRole('button', { name: /Decline/ }));
    await waitFor(() => expect(live()).toBe('Declined the request'));
  });

  it('lets a request another manager answered first leave, saying so', async () => {
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request());
    index.fail.set('grantAccessRequest', new IndexError(404, 'access_request_not_found'));
    renderInbox(index);
    fireEvent.click(await screen.findByRole('button', { name: /Share as Viewer/ }));
    await waitFor(() => expect(live()).toBe('Already answered'));
    expect(screen.queryByRole('option', { name: /Asked for access/ })).toBeNull();
  });

  it.each([
    [
      'grantAccessRequest',
      new IndexError(409, 'share_link_limit'),
      /Share as Viewer/,
      'Launch Plan has as many passes as it can hold. Delete one in Share, then try again.',
    ],
    [
      'grantAccessRequest',
      new IndexError(409, 'archived'),
      /Share as Viewer/,
      'Move Launch Plan out of Archived to share it.',
    ],
    [
      'grantAccessRequest',
      new Error('offline'),
      /Share as Viewer/,
      'Couldn’t share it. Try again.',
    ],
    [
      'declineAccessRequest',
      new IndexError(500, 'unknown'),
      /Decline/,
      'Couldn’t decline it. Try again.',
    ],
  ])('keeps the row on %s failing (%s), saying why', async (method, error, button, words) => {
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request());
    index.fail.set(method, error as IndexError);
    renderInbox(index);
    fireEvent.click(await screen.findByRole('button', { name: button }));
    expect((await screen.findByRole('alert')).textContent).toBe(words);
    expect(screen.getByRole('option', { name: /Asked for access/ })).toBeTruthy();
  });

  it('says This item for an untitled one at its cap', async () => {
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request({ itemTitle: '' }));
    index.fail.set('grantAccessRequest', new IndexError(409, 'share_link_limit'));
    renderInbox(index);
    fireEvent.click(await screen.findByRole('button', { name: /Share as Viewer/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^This item has/);
  });

  it('takes no second press while one is out, and Sharing… says so', async () => {
    const index = createFakeIndex();
    index.inbox.accessRequests!.push(request());
    index.hold.add('grantAccessRequest');
    renderInbox(index);
    const share = await screen.findByRole('button', { name: /Share as Viewer/ });
    fireEvent.click(share);
    await screen.findByText('Sharing…');
    fireEvent.click(screen.getByRole('button', { name: /Sharing/ }));
    fireEvent.click(screen.getByRole('button', { name: /Decline/ }));
    expect(index.count('grantAccessRequest')).toBe(1);
    expect(index.count('declineAccessRequest')).toBe(0);
    await act(async () => index.release());
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: /Asked for access/ })).toBeNull(),
    );
  });
});
