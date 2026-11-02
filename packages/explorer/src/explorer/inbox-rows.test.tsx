// The Inbox's one row at its two densities (the page's and the editor panel's): three lines of who, what, and why
// and where; the skeleton that matches it while the Inbox reads, the empty state, and a This Browser row.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { shortAgo } from './inbox/InboxRows';
import { describe, expect, it, vi } from 'vitest';
import type { InboxAction, InboxThread } from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import { ToastProvider } from '../ui/Toasts';
import { ExplorerProvider } from './context';
import { InboxPane } from './InboxPane';

const NOW = 1_700_000_000_000;

const action: InboxAction = {
  app: 'livediagram',
  itemId: 'canvas-1',
  itemTitle: 'Payments architecture',
  itemTeamId: 'team-1',
  tabId: 'tab-1',
  tabName: 'Overview',
  elementId: 'el-1',
  actionId: 'a1',
  elementLabel: 'Billing service',
  name: 'Split the ledger out',
  description: '',
  status: 'open',
  assigneeId: 'user_me',
  assigneeName: 'Me',
  assignerId: 'user_ada',
  assignerName: null,
  teamId: 'team-1',
  card: null,
  createdAt: NOW - 3_600_000,
  updatedAt: NOW - 8 * 60_000,
};

const thread: InboxThread = {
  app: 'livediagram',
  itemId: 'canvas-1',
  itemTitle: 'Payments architecture',
  itemTeamId: null,
  tabId: 'tab-1',
  tabName: 'Overview',
  elementId: 'el-2',
  elementLabel: 'Ledger',
  resolved: false,
  commentCount: 1,
  latestText: 'Agreed.',
  latestAuthorName: '',
  latestAuthorColor: '',
  card: null,
  mentionsYou: false,
  youCommented: false,
  onYourItem: true,
  firstAt: NOW - 60_000,
  latestAt: NOW - 60_000,
};

function renderPane(
  index: ReturnType<typeof createFakeIndex>,
  {
    compact = false,
    filter = 'all' as const,
    filterSlot,
  }: { compact?: boolean; filter?: 'all'; filterSlot?: HTMLElement | null } = {},
) {
  return render(
    <ToastProvider>
      <ExplorerProvider
        app="livediagram"
        client={index.client}
        view={{ kind: 'inbox' }}
        filter={filter}
        setFilter={vi.fn()}
        onNavigate={vi.fn()}
        itemHref={(i) => `/open/${i.id}`}
        onCreate={vi.fn()}
        viewerId="user_me"
      >
        <InboxPane compact={compact} filterSlot={filterSlot} />
      </ExplorerProvider>
    </ToastProvider>,
  );
}

async function settle() {
  await act(async () => {});
}

describe('an Inbox row', () => {
  it('reads in three lines: who and when, what, then why and where; one option, no links', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const index = createFakeIndex();
    index.inbox.actions.push(action);
    const { container } = renderPane(index);
    await settle();
    const row = screen.getByRole('option', { name: /Split the ledger out/ });
    expect(container.querySelectorAll('[data-inbox-row] a')).toHaveLength(0);
    expect(row.getAttribute('data-density')).toBe('comfortable');
    // An unnamed assigner: a teammate, on a person glyph rather than initials, in bold as it asks something of me.
    const who = row.querySelector('[data-inbox-who]')!;
    expect(who.textContent).toBe('A teammate');
    expect(who.className).toContain('font-semibold');
    expect(row.querySelector('[data-inbox-avatar] svg')).toBeTruthy();
    expect(row.querySelector('time')!.textContent).toBe('8m');
    expect(row.querySelector('[data-inbox-title]')!.textContent).toBe('Split the ledger out');
    expect(row.querySelector('[data-inbox-reason="assigned"]')!.textContent).toBe('To do');
    // Where: the app's mark (the All filter) and the item; the whole path on hover and in the name.
    expect(row.querySelector('[data-app-mark="livediagram"]')).toBeTruthy();
    expect(row.querySelector('[title*="›"]')!.getAttribute('title')).toBe(
      'Payments architecture › Overview › Billing service',
    );
    expect(row.getAttribute('aria-label')).toBe(
      'Split the ledger out. To do. A teammate. In Payments architecture, Overview, Billing service',
    );
    vi.restoreAllMocks();
  });

  it('is the same row in the panel, at the compact density', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const index = createFakeIndex();
    index.inbox.actions.push(action);
    renderPane(index, { compact: true });
    await settle();
    const row = screen.getByRole('option', { name: /Split the ledger out/ });
    expect(row.getAttribute('data-density')).toBe('compact');
    expect(row.querySelector('[data-inbox-title]')!.getAttribute('title')).toBe(
      'Split the ledger out',
    );
    vi.restoreAllMocks();
  });

  it('leaves the app mark out when the filter is this app', async () => {
    const index = createFakeIndex();
    index.inbox.actions.push(action);
    renderPane(index, { filter: 'app' as 'all' });
    await settle();
    const row = screen.getByRole('option', { name: /Split the ledger out/ });
    expect(row.querySelector('[data-app-mark]')).toBeNull();
  });

  it('names a This Browser row as such, and says why a thread on your item is there', async () => {
    const index = createFakeIndex();
    const localRows = vi.fn().mockResolvedValue({
      actions: [],
      threads: [{ ...thread, itemId: 'local-1', itemTitle: 'Offline canvas' }],
    });
    render(
      <ToastProvider>
        <ExplorerProvider
          app="livediagram"
          client={index.client}
          view={{ kind: 'inbox' }}
          filter="app"
          setFilter={vi.fn()}
          onNavigate={vi.fn()}
          itemHref={(i) => `/open/${i.id}`}
          onCreate={vi.fn()}
          viewerId="user_me"
          inboxHost={{ localRows }}
        >
          <InboxPane />
        </ExplorerProvider>
      </ToastProvider>,
    );
    const row = await screen.findByRole('option', { name: /Ledger/ });
    expect(row.getAttribute('aria-label')).toBe(
      'Ledger. On your canvas. A teammate. In Offline canvas, Overview, This Browser',
    );
    expect(row.querySelector('[data-this-browser]')!.textContent).toMatch(/^This Browser/);
    // No author name: a teammate wrote it.
    expect(row.querySelector('[data-inbox-who]')!.textContent).toBe('A teammate');
  });

  it('says its age in a few characters', () => {
    const m = 60_000;
    expect(shortAgo(NOW - 20_000, NOW)).toBe('now');
    expect(shortAgo(NOW - 12 * m, NOW)).toBe('12m');
    expect(shortAgo(NOW - 3 * 60 * m, NOW)).toBe('3h');
    expect(shortAgo(NOW - 2 * 24 * 60 * m, NOW)).toBe('2d');
    expect(shortAgo(NOW - 30 * 24 * 60 * m, NOW)).toMatch(/\d/);
  });

  it('shows skeleton rows of the same shape while the Inbox reads, at either density', () => {
    for (const compact of [false, true]) {
      const index = createFakeIndex();
      index.client.inbox = () => new Promise(() => {});
      const view = renderPane(index, { compact });
      const skeleton = screen.getByRole('status', { name: 'Loading your Inbox' });
      const rows = within(skeleton).getAllByRole('listitem');
      expect(rows).toHaveLength(4);
      // An avatar's disc, at the row's own size.
      expect(rows[0]!.firstElementChild!.className).toContain(compact ? 'size-8' : 'size-9');
      view.unmount();
    }
  });

  it('says you are all caught up when nothing is open, in the panel too', async () => {
    for (const compact of [false, true]) {
      const view = renderPane(createFakeIndex(), { compact });
      await settle();
      expect(screen.getByText('You’re all caught up')).toBeTruthy();
      expect(screen.queryByRole('option')).toBeNull();
      view.unmount();
    }
  });
});

describe('the panel’s Inbox filter dropdown', () => {
  const seeded = () => {
    const index = createFakeIndex();
    index.inbox.actions.push(action);
    index.inbox.threads.push(thread);
    return index;
  };

  it('is a named select with each count, in a row of its own without a slot, and filters the list', async () => {
    const index = seeded();
    const { container } = renderPane(index, { compact: true });
    await settle();
    expect(container.querySelector('[role="group"][aria-label="Inbox filters"]')).toBeNull();
    const select = screen.getByRole('combobox', { name: 'Inbox filter' }) as HTMLSelectElement;
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual([
      'All (2)',
      'My Actions (1)',
      'Assigned by Me (0)',
      'Comments (1)',
      'Form Responses (0)',
    ]);
    expect(select.value).toBe('all');
    fireEvent.change(select, { target: { value: 'comments' } });
    expect(select.value).toBe('comments');
    expect(screen.getAllByRole('option', { name: /Agreed|Ledger/ })).toHaveLength(1);
    // A value the select cannot hold is ignored.
    fireEvent.change(select, { target: { value: 'nonsense' } });
    expect(select.value).toBe('comments');
  });

  it('is drawn into the header slot when the panel has one, and nowhere while the slot mounts', async () => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const index = seeded();
    const first = renderPane(index, { compact: true, filterSlot: null });
    await settle();
    expect(screen.queryByRole('combobox', { name: 'Inbox filter' })).toBeNull();
    first.unmount();
    renderPane(index, { compact: true, filterSlot: slot });
    await settle();
    expect(within(slot).getByRole('combobox', { name: 'Inbox filter' })).toBeTruthy();
    slot.remove();
  });

  it('leaves the page’s chip bar alone', async () => {
    renderPane(seeded());
    await settle();
    expect(screen.getByRole('group', { name: 'Inbox filters' })).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
