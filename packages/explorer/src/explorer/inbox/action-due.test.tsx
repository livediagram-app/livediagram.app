// An action's due day on its Inbox row (liveworkspace/docs/specs/004-index/inbox-reading.md "A row says what happened",
// Work Tracker 1487): after the row's reason, worded as its editor words it, red once past, and nothing more on an
// action with none. A card's due day reads the same.
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxAction } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../../test/fakeClient';
import { Explorer } from '../Explorer';
import { DueTag, entryFacts } from './InboxRows';
import { inboxEntries, inboxSections } from './sections';

// Noon on Thursday 26 November 2026, local time.
const NOW = new Date(2026, 10, 26, 12).getTime();

const action = (patch: Partial<InboxAction> = {}): InboxAction => ({
  app: 'liveknowledge',
  itemId: 'kb-1',
  itemTitle: 'Handbook',
  itemTeamId: null,
  tabId: 'tab-1',
  tabName: 'Onboarding',
  elementId: 'el-1',
  actionId: 'a1',
  elementLabel: 'Laptops',
  name: 'Order the laptops',
  description: '',
  status: 'open',
  assigneeId: 'user_me',
  assigneeName: 'Me',
  assignerId: 'user_sam',
  assignerName: 'Sam Lee',
  teamId: null,
  card: null,
  createdAt: 1,
  updatedAt: NOW - 60_000,
  ...patch,
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const rowOf = (name: string) =>
  within(screen.getByRole('listbox', { name: /^Inbox/ }))
    .getAllByRole('option')
    .find((o) => o.textContent?.includes(name)) as HTMLElement;

describe('an action’s due day in the Inbox', () => {
  it('says a due, an overdue and no due day on their rows', async () => {
    const index = createFakeIndex({ items: [makeItem(1, { id: 'kb-1', access: 'edit' })] });
    index.inbox.actions.push(
      action({ actionId: 'a1', name: 'Order the laptops', due: '2026-12-03' }),
      action({ actionId: 'a2', name: 'Book the trainer', due: '2026-11-20' }),
      action({ actionId: 'a3', name: 'Write the welcome' }),
    );
    render(
      <Explorer
        app="liveknowledge"
        client={index.client}
        view={{ kind: 'inbox' }}
        onNavigate={vi.fn()}
        itemHref={(item) => `https://${item.app}.app/open/${item.id}`}
        onCreate={vi.fn()}
        viewerId="user_me"
      />,
    );
    await screen.findByRole('listbox', { name: /^Inbox/ });

    const due = rowOf('Order the laptops');
    const dueTag = due.querySelector<HTMLElement>('[data-inbox-due]')!;
    expect(dueTag.textContent).toBe('Due Thu 3 Dec');
    expect(dueTag.dataset.inboxDue).toBe('later');
    expect(dueTag.className).not.toMatch(/text-red/);
    expect(due.getAttribute('aria-label')).toContain('To do. Due Thu 3 Dec.');

    const overdue = rowOf('Book the trainer');
    const overdueTag = overdue.querySelector<HTMLElement>('[data-inbox-due]')!;
    expect(overdueTag.textContent).toBe('Due Fri 20 Nov');
    expect(overdueTag.className).toMatch(/text-red-700/);
    expect(overdue.getAttribute('aria-label')).toContain('Due Fri 20 Nov');

    const undated = rowOf('Write the welcome');
    expect(undated.querySelector('[data-inbox-due]')).toBeNull();
    expect(undated.getAttribute('aria-label')).not.toContain('Due');
  });

  it('takes a card’s due day from its card, and none off an action or card', () => {
    const facts = (a: InboxAction) =>
      inboxEntries(inboxSections({ threads: [], actions: [a], forms: [] }, 'user_me')).map(
        (e) => entryFacts(e, 'user_me').due,
      );
    const card = {
      key: 4,
      type: 'task',
      typeLabel: 'Task',
      title: 'Ship it',
      board: null,
      due: '2026-11-27',
    };
    expect(facts(action({ due: '2026-12-03' }))).toEqual(['2026-12-03']);
    expect(facts(action({ tabId: '~cards', card }))).toEqual(['2026-11-27']);
    expect(facts(action())).toEqual([null]);
    expect(facts(action({ tabId: '~cards', card: { ...card, due: undefined } }))).toEqual([null]);
  });

  it('says nothing for a day that is no calendar day', () => {
    const { container } = render(<DueTag due="3 Dec" />);
    expect(container.textContent).toBe('');
  });
});
