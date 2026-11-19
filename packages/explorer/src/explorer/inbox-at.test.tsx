// Arriving at the Inbox from a notice (InboxPane.tsx, inbox/useInboxArrival.ts; inbox-notices.md): `?at=<row key>`
// chooses that row once listed, under All when the saved filter hides it; and the list on screen marks its rows seen
// and gone for the notices, only while the tab is in view.
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InboxForm, InboxThread } from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import { seenStoreFor } from '../inbox-notices/seen';
import { Explorer } from './Explorer';
import { INBOX_FILTER_KEY } from './InboxPane';

const NOW = Date.now();

const thread = (id: string, latestAt: number): InboxThread => ({
  app: 'liveplanner',
  itemId: id,
  itemTitle: `Plan ${id}`,
  itemTeamId: null,
  tabId: 't1',
  tabName: 'Board',
  elementId: 'e1',
  elementLabel: `Box ${id}`,
  card: null,
  resolved: false,
  commentCount: 1,
  latestText: 'Hello',
  latestAuthorName: 'Priya',
  latestAuthorColor: '#000',
  latestAuthorId: 'user_p',
  mentionsYou: true,
  youCommented: false,
  onYourItem: false,
  firstAt: latestAt,
  latestAt,
});

const form = (): InboxForm => ({
  app: 'liveplanner',
  itemId: 'f1',
  itemTitle: 'Survey',
  itemTeamId: null,
  tabId: 'ft',
  heading: 'Survey',
  boardTabId: null,
  unseen: 2,
  latestAt: NOW,
});

function renderAt(
  index: ReturnType<typeof createFakeIndex>,
  at: string | null,
  viewerId = 'user_me',
) {
  window.history.replaceState(
    null,
    '',
    at ? `/explorer/inbox?at=${encodeURIComponent(at)}` : '/explorer/inbox',
  );
  return render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'inbox' }}
      onNavigate={vi.fn()}
      itemHref={(item) => `/open/${item.id}`}
      onCreate={vi.fn()}
      viewerId={viewerId}
    />,
  );
}

const chosen = () => within(screen.getByRole('listbox')).getByRole('option', { selected: true });

afterEach(() => {
  window.history.replaceState(null, '', '/');
  window.localStorage.clear();
});

describe('?at= from a notice', () => {
  it('chooses that row, not the newest', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread('new', NOW), thread('old', NOW - 60_000));
    renderAt(index, 't:liveplanner:old:t1:e1');
    await waitFor(() => expect(chosen().textContent).toContain('Box old'));
  });

  it('shows All when the saved filter hides the row', async () => {
    window.localStorage.setItem(`${INBOX_FILTER_KEY}:user_me`, 'forms');
    const index = createFakeIndex();
    index.inbox.threads.push(thread('a', NOW - 1000));
    index.inbox.forms.push(form());
    renderAt(index, 't:liveplanner:a:t1:e1');
    await waitFor(() => expect(chosen().textContent).toContain('Box a'));
    expect(screen.getByRole('combobox', { name: 'Inbox filter' })).toHaveProperty('value', 'all');
  });

  it('a row no longer listed chooses nothing of its own', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread('a', NOW));
    renderAt(index, 't:liveplanner:gone:t1:e1');
    await screen.findByRole('listbox');
    expect(chosen().textContent).toContain('Box a');
  });
});

describe('the list on screen reads its rows', () => {
  it('marks every listed row seen and gone for the reader', async () => {
    const index = createFakeIndex();
    index.inbox.threads.push(thread('a', NOW));
    renderAt(index, null, 'user_seen');
    await screen.findByRole('listbox');
    const seen = seenStoreFor('user_seen');
    await waitFor(() => expect(seen.gone({ key: 't:liveplanner:a:t1:e1', at: NOW })).toBe(true));
  });

  it('marks nothing while the tab is hidden', async () => {
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const index = createFakeIndex();
    index.inbox.threads.push(thread('a', NOW));
    renderAt(index, null, 'user_hidden');
    await screen.findByRole('listbox');
    expect(seenStoreFor('user_hidden').gone({ key: 't:liveplanner:a:t1:e1', at: NOW })).toBe(false);
    hidden.mockRestore();
  });
});
