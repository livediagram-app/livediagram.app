// The Inbox's one row at its two densities: the page's comfortable row and the editor panel's compact one, the
// skeleton that matches them while the Inbox reads, the empty state, and a This Browser row's name.
import { act, render, screen, within } from '@testing-library/react';
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
  { compact = false, filter = 'all' as const } = {},
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
        <InboxPane compact={compact} />
      </ExplorerProvider>
    </ToastProvider>,
  );
}

async function settle() {
  await act(async () => {});
}

describe('an Inbox row', () => {
  it('is one link on the page: the app, the whole path, the full time and an Open arrow', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const index = createFakeIndex();
    index.inbox.actions.push(action);
    const { container } = renderPane(index);
    await settle();
    const row = screen.getByRole('link', { name: /Split the ledger out/ });
    expect(container.querySelectorAll('[data-inbox-row] a')).toHaveLength(1);
    expect(row.closest('li')!.getAttribute('data-density')).toBe('comfortable');
    // Where: the app's mark (the All filter), the item, the tab, then the element.
    expect(row.querySelector('[data-app-mark="livediagram"]')).toBeTruthy();
    expect(row.textContent).toContain('Payments architecture');
    expect(row.textContent).toContain('Overview');
    expect(row.textContent).toContain('Billing service');
    expect(row.querySelector('time')!.textContent).toBe('8 mins ago');
    // An unnamed assigner: a teammate, on a person glyph rather than initials.
    expect(row.getAttribute('aria-label')).toBe(
      'Split the ledger out. Assigned to you by a teammate. In Payments architecture, Overview, Billing service',
    );
    expect(row.querySelector('[data-inbox-avatar] svg')).toBeTruthy();
    // The Open arrow, decorative.
    expect(row.lastElementChild!.getAttribute('aria-hidden')).toBe('true');
    vi.restoreAllMocks();
  });

  it('is compact in the panel: the innermost place, a short time and no arrow', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const index = createFakeIndex();
    index.inbox.actions.push(action);
    renderPane(index, { compact: true });
    await settle();
    const row = screen.getByRole('link', { name: /Split the ledger out/ });
    expect(row.closest('li')!.getAttribute('data-density')).toBe('compact');
    expect(row.textContent).toContain('Billing service');
    expect(row.textContent).not.toContain('Overview');
    // The whole path is still there, on hover and in the name.
    expect(row.querySelector('[title*="›"]')!.getAttribute('title')).toBe(
      'Payments architecture › Overview › Billing service',
    );
    expect(row.getAttribute('aria-label')).toContain('Overview');
    expect(row.querySelector('time')!.textContent).toBe('8 min ago');
    expect(row.querySelector('[data-inbox-title]')!.getAttribute('title')).toBe(
      'Split the ledger out',
    );
    expect(row.lastElementChild!.getAttribute('aria-hidden')).toBeNull();
    vi.restoreAllMocks();
  });

  it('leaves the app mark out when the filter is this app', async () => {
    const index = createFakeIndex();
    index.inbox.actions.push(action);
    renderPane(index, { filter: 'app' as 'all' });
    await settle();
    const row = screen.getByRole('link', { name: /Split the ledger out/ });
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
    const row = await screen.findByRole('link', { name: /Ledger/ });
    expect(row.getAttribute('aria-label')).toBe(
      'Ledger. On your canvas. 1 comment. In Offline canvas, Overview, This Browser',
    );
    expect(row.querySelector('[data-this-browser]')!.textContent).toBe('This Browser');
    // No author name: a teammate wrote it.
    expect(row.querySelector('[data-inbox-detail]')!.textContent).toBe('A teammate: Agreed.');
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
      expect(screen.queryByRole('link')).toBeNull();
      view.unmount();
    }
  });
});
