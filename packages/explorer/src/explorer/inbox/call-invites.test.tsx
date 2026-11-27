// Invites to calls about items in the Inbox (liveworkspace/docs/specs/004-index/item-calls.md "Invites"; Work Tracker
// 1367): an invite is a row that asks nothing that waits, so it is never semibold and never counted; its Calls filter
// shows while there is one; its pane reads the call as it stands now and joins it in the call's own tab; a notice tells
// the reader once.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxCallInvite, ItemCall } from '@liveworkspace/index-client';
import { createFakeIndex } from '../../test/fakeClient';
import type { InboxData } from '../../data/useInbox';
import { noticeRows } from '../../inbox-notices/rows';
import { inboxSignature } from '../../inbox-notices/watch';
import { Explorer } from '../Explorer';
import { entryPlace, entryTarget } from './inbox-entry-place';
import { leadGlyph } from './InboxRows';
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

const NOW = new Date(2026, 10, 22, 12, 0).getTime();
const MIN = 60_000;

const invite = (patch: Partial<InboxCallInvite> = {}): InboxCallInvite => ({
  id: 'iv_1',
  app: 'livediagram',
  itemId: 'd-1',
  itemTitle: 'Login Flow',
  itemTeamId: null,
  byName: 'Priya Shah',
  at: NOW - 5 * MIN,
  live: true,
  ...patch,
});

const call: ItemCall = {
  id: 'ic_1',
  spaceId: 'sp-1',
  link: 'https://huddle.test/s/abc',
  people: 3,
  names: ['Priya'],
  startedAt: NOW - 10 * MIN,
  endedAt: null,
} as ItemCall;

const data = (calls: InboxCallInvite[]): InboxData => ({
  threads: [],
  actions: [],
  forms: [],
  calls,
});

function renderInbox(itemCalls: ReturnType<typeof vi.fn>, inv = invite()) {
  const index = createFakeIndex();
  index.inbox.calls!.push(inv);
  const client = { ...index.client, itemCalls } as typeof index.client;
  return render(
    <Explorer
      app="livediagram"
      client={client}
      view={{ kind: 'inbox' }}
      onNavigate={vi.fn()}
      itemHref={(i) => `/open/${i.id}`}
      onCreate={vi.fn()}
      viewerId="user_me"
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the model', () => {
  it('lists each invite under its key, in the total but never the badge', () => {
    const d = data([invite(), invite({ id: 'iv_2', at: NOW - MIN })]);
    const entries = inboxEntries(inboxSections(d, 'user_me'));
    expect(entries.map((e) => e.key)).toEqual(['k:iv_2', 'k:iv_1']);
    expect(entries[0]!.kind).toBe('CallInvite');
    expect(inboxTotal(d, 'user_me')).toBe(2);
    expect(inboxBadge(d, 'user_me')).toBeUndefined();
  });

  it('reads an Inbox without calls as none, and offers Calls only while there is one', () => {
    expect(inboxSections({ threads: [], actions: [], forms: [] }, null).calls).toEqual([]);
    const none = inboxFilterCounts([]);
    expect(shownFilters(none, 'all')).not.toContain('calls');
    expect(shownFilters(none, 'calls')).toContain('calls');
    const one = inboxFilterCounts(inboxEntries(inboxSections(data([invite()]), 'user_me')));
    expect(one.calls).toBe(1);
    expect(shownFilters(one, 'all')).toContain('calls');
  });

  it('keeps an invite settled here out, opens the item, and takes no host verbs', () => {
    const d = data([invite()]);
    const [entry] = inboxEntries(inboxSections(d, 'user_me'));
    const settled = settledOf(entry!);
    expect(settled).toEqual({ key: 'k:iv_1', at: NOW - 5 * MIN });
    expect(withoutSettled(d, new Map([[settled.key, settled.at]])).calls).toEqual([]);
    expect(entryPlace(entry!)).toEqual({});
    expect(entryTarget(entry!)).toBeNull();
    expect(leadGlyph(entry!)).toBe('call');
  });

  it('lists an invite in the signature, and notices it once', () => {
    expect(inboxSignature(data([invite()]))).toBe(`k:iv_1@${NOW - 5 * MIN}`);
    const rows = noticeRows(data([invite({ byName: '' })]), 'user_me', 'livediagram');
    expect(rows[0]).toMatchObject({
      key: 'k:iv_1',
      kind: 'call',
      who: 'Someone',
      verb: 'invited you to a call',
      place: 'Login Flow',
      href: '/explorer/inbox?at=k%3Aiv_1',
    });
  });
});

describe('the row and the pane', () => {
  it('says who invited, never semibold, and joins the live call in its own tab', async () => {
    const itemCalls = vi.fn().mockResolvedValue({ live: call, calls: [] });
    const tab = { location: { href: 'about:blank' }, opener: {}, focus: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    renderInbox(itemCalls);
    const row = await screen.findByRole('option', { name: /Call in progress/ });
    expect(row.getAttribute('data-inbox-key')).toBe('k:iv_1');
    // Bold while unread (inbox-reading.md), as every row is; it asks nothing, so it is never counted.
    expect(row.hasAttribute('data-inbox-unread')).toBe(true);
    expect(row.querySelector('[data-inbox-glyph="call"]')).toBeTruthy();
    const pane = document.querySelector('[data-inbox-reader="CallInvite"]') as HTMLElement;
    expect(
      within(pane).getByText('Priya Shah invited you to a call about Login Flow'),
    ).toBeTruthy();
    expect(await within(pane).findByText('3 people in it now')).toBeTruthy();
    expect(itemCalls).toHaveBeenCalledWith('d-1');
    fireEvent.click(within(pane).getByRole('button', { name: 'Join Call' }));
    expect(open).toHaveBeenCalledWith('', 'lw-call-d-1');
    expect(tab.location.href).toBe(call.link);
    expect(tab.opener).toBeNull();
  });

  it('says a call has ended, or could not be read', async () => {
    const ended = vi.fn().mockResolvedValue({ live: null, calls: [] });
    const { unmount } = renderInbox(ended, invite({ live: false }));
    await screen.findByRole('option', { name: /Login Flow/ });
    expect(await screen.findByText(/The call has ended/)).toBeTruthy();
    unmount();
    renderInbox(vi.fn().mockRejectedValue(new Error('offline')));
    expect(await screen.findByText(/The call has ended/)).toBeTruthy();
  });
});
