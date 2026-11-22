// Updates on watched pages in the Inbox (liveworkspace/docs/specs/004-index/inbox.md "Updates"; liveknowledge's
// Watching; Work Tracker 1340): a change to a page the reader watches is a row that asks nothing, so it is never
// semibold and never counted; its own Updates filter shows while there is one; its pane says who changed what and
// opens the page; a notice tells the reader once per row.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxUpdate } from '@liveworkspace/index-client';
import { createFakeIndex } from '../../test/fakeClient';
import type { InboxData } from '../../data/useInbox';
import { noticeRows } from '../../inbox-notices/rows';
import { inboxSignature } from '../../inbox-notices/watch';
import { Explorer, type ExplorerProps } from '../Explorer';
import { entryPlace, entryTarget } from './inbox-entry-place';
import { leadGlyph } from './InboxRows';
import { updateLines, updateSentence } from './InboxReaderBody';
import {
  inboxBadge,
  inboxEntries,
  inboxFilterCounts,
  inboxSections,
  inboxTotal,
  settledOf,
  shownFilters,
  updateReason,
  withoutSettled,
} from './sections';

const NOW = new Date(2026, 10, 22, 12, 0).getTime();
const MIN = 60_000;

const update = (patch: Partial<InboxUpdate> = {}): InboxUpdate => ({
  id: 'up_1',
  app: 'liveknowledge',
  itemId: 'kb-1',
  itemTitle: 'Handbook',
  itemTeamId: null,
  tabId: 'page-7',
  tabName: 'Expenses',
  kinds: ['saved'],
  actors: [
    { id: 'user_priya', name: 'Priya Shah' },
    { id: 'user_bo', name: 'Bo Lund' },
  ],
  actorCount: 3,
  count: 4,
  firstAt: NOW - 40 * MIN,
  latestAt: NOW - 25 * MIN,
  ...patch,
});

const data = (updates: InboxUpdate[]): InboxData => ({
  threads: [],
  actions: [],
  forms: [],
  updates,
});

function renderInbox(index: ReturnType<typeof createFakeIndex>, over: Partial<ExplorerProps> = {}) {
  return render(
    <Explorer
      app="liveknowledge"
      client={index.client}
      view={{ kind: 'inbox' }}
      onNavigate={vi.fn()}
      itemHref={(i, place) => `/open/${i.id}${place?.tabId ? `?tab=${place.tabId}` : ''}`}
      onCreate={vi.fn()}
      viewerId="user_me"
      {...over}
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
});

describe('the model', () => {
  it('lists each update under its key, in the total but never the badge', () => {
    const d = data([update(), update({ id: 'up_2', latestAt: NOW - MIN })]);
    const entries = inboxEntries(inboxSections(d, 'user_me'));
    expect(entries.map((e) => e.key)).toEqual([
      'u:liveknowledge:kb-1:up_2',
      'u:liveknowledge:kb-1:up_1',
    ]);
    expect(entries[0]!.kind).toBe('Update');
    expect(inboxTotal(d, 'user_me')).toBe(2);
    expect(inboxBadge(d, 'user_me')).toBeUndefined();
  });

  it('reads an Inbox from an index without updates as none', () => {
    const d: InboxData = { threads: [], actions: [], forms: [] };
    expect(inboxSections(d, 'user_me').updates).toEqual([]);
    expect(inboxSignature(d)).toBe('');
  });

  it('offers Updates only while there is one, or it is the choice', () => {
    const none = inboxFilterCounts([]);
    expect(shownFilters(none, 'all')).not.toContain('updates');
    expect(shownFilters(none, 'updates')).toContain('updates');
    const one = inboxFilterCounts(inboxEntries(inboxSections(data([update()]), 'user_me')));
    expect(one.updates).toBe(1);
    expect(shownFilters(one, 'all')).toContain('updates');
  });

  it('keeps an update settled here out until a later change', () => {
    const d = data([update()]);
    const [entry] = inboxEntries(inboxSections(d, 'user_me'));
    const settled = settledOf(entry!);
    expect(settled).toEqual({ key: 'u:liveknowledge:kb-1:up_1', at: NOW - 25 * MIN });
    const map = new Map([[settled.key, settled.at]]);
    expect(withoutSettled(d, map).updates).toEqual([]);
    expect(withoutSettled(data([update({ latestAt: NOW })]), map).updates).toHaveLength(1);
  });

  it.each([
    [['saved'], 'Edited'],
    [['review_due'], 'Verification Lapsed'],
    [['approved', 'saved'], 'Approved +1'],
    [['rejected'], 'Rejected'],
    [['moved', 'saved', 'approved'], 'Moved +2'],
    [['deleted'], 'Deleted'],
    [[], 'Changed'],
  ] as const)('says %j as %s', (kinds, label) => {
    expect(updateReason({ kinds: [...kinds] })).toEqual({ kind: 'update', label });
  });

  it('opens the page, a deleted one at its item, and takes no host verbs', () => {
    const [entry] = inboxEntries(inboxSections(data([update()]), 'user_me'));
    expect(entryPlace(entry!)).toEqual({ tabId: 'page-7' });
    expect(entryTarget(entry!)).toBeNull();
    expect(leadGlyph(entry!)).toBe('watch');
    const [gone] = inboxEntries(inboxSections(data([update({ kinds: ['deleted'] })]), null));
    expect(entryPlace(gone!)).toEqual({});
  });

  it('lists an update in the signature by its key and latest change', () => {
    expect(inboxSignature(data([update()]))).toBe(`u:liveknowledge:kb-1:up_1@${NOW - 25 * MIN}`);
    expect(inboxSignature(data([update()]), 'liveplanner')).toBe('');
  });
});

describe('the words', () => {
  it.each([
    [{ actorCount: 3, count: 4 }, 'Priya', 'Priya and 2 others changed this page · 4 changes'],
    [{ actorCount: 2, count: 1 }, 'Priya', 'Priya and 1 other changed this page'],
    [{ actorCount: 1, count: 2 }, 'Priya', 'Priya changed this page · 2 changes'],
  ])('says %j by %s', (patch, who, sentence) => {
    expect(updateSentence(update(patch), 'user_priya', who)).toBe(sentence);
  });

  it('says a review came due, or a change by nobody named', () => {
    expect(updateSentence(update({ kinds: ['review_due'], actors: [] }), null, 'Someone')).toBe(
      'Its review came due',
    );
    expect(updateSentence(update({ actors: [], count: 3 }), null, 'Someone')).toBe(
      'This page changed · 3 changes',
    );
  });

  it('lists each kind in plain words, the decider by first name', () => {
    const all = update({
      kinds: ['saved', 'review_due', 'approved', 'rejected', 'moved', 'deleted'],
    });
    expect(updateLines(all, 'user_priya').map((l) => l.text)).toEqual([
      'Edited and saved',
      'Its verification lapsed: it is due for review',
      'Approved by Bo',
      'Rejected by Bo',
      'Moved to another place in the tree',
      'Deleted: it is in the knowledgebase’s Trash',
    ]);
    expect(updateLines(update({ kinds: ['approved'], actors: [] }), null)[0]!.text).toBe(
      'Approved by a teammate',
    );
  });
});

describe('the notice', () => {
  it('tells the reader once per row, at its first change, naming the newest other person', () => {
    const rows = noticeRows(
      {
        threads: [],
        actions: [],
        forms: [],
        updates: [update({ actors: [{ id: 'user_me', name: 'Me' }, ...update().actors] })],
      },
      'user_me',
      'liveknowledge',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: 'u:liveknowledge:kb-1:up_1',
      at: NOW - 40 * MIN,
      kind: 'update',
      who: 'Priya Shah',
      verb: 'changed a page you watch',
      place: 'Handbook',
      detail: 'Expenses · Edited',
      href: '/explorer/inbox?at=u%3Aliveknowledge%3Akb-1%3Aup_1',
    });
  });

  it('says a page came due for review, and Someone for nobody named', () => {
    const rows = noticeRows(
      {
        threads: [],
        actions: [],
        forms: [],
        updates: [
          update({ id: 'a', kinds: ['review_due'], actors: [], tabName: '' }),
          update({ id: 'b', actors: [{ id: 'user_x', name: '' }] }),
        ],
      },
      'user_me',
      'liveknowledge',
    );
    const [due, someone] = [
      rows.find((r) => r.key.endsWith(':a'))!,
      rows.find((r) => r.key.endsWith(':b'))!,
    ];
    expect(`${due.who} ${due.verb}`).toBe('A page you watch is due for review');
    expect(due.detail).toBe('Verification Lapsed');
    expect(someone.who).toBe('Someone');
  });
});

describe('the row and the pane', () => {
  it('says who changed the page and why it is here, never semibold, and opens it', async () => {
    const onTelemetry = vi.fn();
    const index = createFakeIndex();
    index.inbox.updates!.push(update({ kinds: ['saved', 'approved'] }));
    renderInbox(index, { inbox: { onTelemetry } });
    const row = await screen.findByRole('option', { name: /Expenses/ });
    expect(row.getAttribute('data-inbox-key')).toBe('u:liveknowledge:kb-1:up_1');
    expect(within(row).getByText('Priya Shah').className).not.toContain('font-semibold');
    expect(within(row).getByText('Edited +1')).toBeTruthy();
    const pane = document.querySelector('[data-inbox-reader="Update"]') as HTMLElement;
    expect(within(pane).getByText('Priya and 2 others changed this page · 4 changes')).toBeTruthy();
    expect(within(pane).getByText('Edited and saved')).toBeTruthy();
    expect(within(pane).getByText('Approved by Priya')).toBeTruthy();
    expect(within(pane).getByText(/You watch this page/)).toBeTruthy();
    expect(screen.getByRole('option', { name: /Updates \(1\)/ })).toBeTruthy();
    const open = within(pane)
      .getByText(/Open in/)
      .closest('a')!;
    expect(open.getAttribute('href')).toBe('/open/kb-1?tab=page-7');
    fireEvent.click(open);
    expect(onTelemetry).toHaveBeenCalledWith('Selected', 'Update');
  });

  it('shows a review that came due with an eye and no person', async () => {
    const index = createFakeIndex();
    index.inbox.updates!.push(update({ kinds: ['review_due'], actors: [], tabName: '' }));
    renderInbox(index);
    const row = await screen.findByRole('option', { name: /Untitled Page/ });
    expect(within(row).getByText('Someone')).toBeTruthy();
    expect(row.querySelector('[data-inbox-glyph="watch"]')).toBeTruthy();
    expect(screen.getByText('Its review came due')).toBeTruthy();
  });
});
