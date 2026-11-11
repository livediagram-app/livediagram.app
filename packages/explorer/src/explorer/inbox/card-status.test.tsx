// A Plan card's status in the Inbox, and the sidebar's count of what waits on the reader (one-explorer-contracts.md
// "Inbox"): a card's row (a card, or one of its threads) shows the column it sits in now as a chip, named in its
// tooltip; a row off a card, or a card no column holds, shows none. The badge counts My Actions and the threads that
// ask something of the reader, an agent's question with their token included.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CollabCard, InboxAction, InboxThread } from '@liveworkspace/index-client';
import type { InboxData } from '../../data/useInbox';
import { CardStatusChip } from '../badges';
import { entryFacts } from './InboxRows';
import { inboxCount, inboxEntries, inboxSections, threadReason } from './sections';

const card: CollabCard = {
  id: 'card-7',
  key: 12,
  type: 'bug',
  typeLabel: 'Bug',
  title: 'Login fails',
  board: { tabId: 'tab-b', elementId: 'board-1', title: 'Sprint', tabName: 'Board' },
  column: { name: 'In Progress', color: '#f97316', done: false },
};

const thread = (patch: Partial<InboxThread> = {}): InboxThread => ({
  app: 'liveplanner',
  itemId: 'plan-1',
  itemTitle: 'Launch',
  itemTeamId: null,
  tabId: '~cards',
  tabName: '',
  elementId: 'th-1',
  elementLabel: 'Ada: The basket empties',
  resolved: false,
  commentCount: 2,
  latestText: 'Still happening',
  latestAuthorName: 'Ada King',
  latestAuthorColor: '#f97316',
  card,
  mentionsYou: false,
  youCommented: false,
  onYourItem: true,
  firstAt: 1,
  latestAt: 100,
  ...patch,
});

const action = (patch: Partial<InboxAction> = {}): InboxAction => ({
  app: 'liveplanner',
  itemId: 'plan-1',
  itemTitle: 'Launch',
  itemTeamId: null,
  tabId: '~cards',
  tabName: '',
  elementId: 'card-7',
  actionId: 'card-7',
  elementLabel: 'Login fails',
  name: 'Login fails',
  description: '',
  status: 'open',
  assigneeId: 'user_me',
  assigneeName: 'Me',
  assignerId: 'user_ada',
  assignerName: 'Ada King',
  teamId: null,
  card: { ...card, id: undefined },
  createdAt: 1,
  updatedAt: 50,
  ...patch,
});

const data = (threads: InboxThread[], actions: InboxAction[] = []): InboxData => ({
  threads,
  actions,
  forms: [],
});

const factsOf = (d: InboxData) =>
  inboxEntries(inboxSections(d, 'user_me')).map((e) => entryFacts(e, 'user_me'));

describe("a card's status chip", () => {
  it('names the column a card thread and a card sit in now, on its colour', () => {
    const [t, a] = factsOf(data([thread()], [action()]));
    expect(t!.column).toEqual({ name: 'In Progress', color: '#f97316', done: false });
    expect(a!.column).toEqual(t!.column);
    const { container } = render(<CardStatusChip column={t!.column} />);
    const chip = container.querySelector('[data-card-status]')!;
    expect(chip.textContent).toBe('In Progress');
    expect(chip.getAttribute('title')).toBe('Status: In Progress');
    expect(chip.getAttribute('aria-label')).toBe('Status: In Progress');
    expect((chip.querySelector('[aria-hidden]') as HTMLElement).style.backgroundColor).toBe(
      'rgb(249, 115, 22)',
    );
  });

  it('greens a done column without a colour, greys any other', () => {
    const done = render(<CardStatusChip column={{ name: 'Done', done: true }} />).container;
    expect(done.querySelector('[data-card-status-done]')).toBeTruthy();
    expect(done.querySelector('[aria-hidden]')!.className).toContain('bg-emerald-500');
    const todo = render(<CardStatusChip column={{ name: 'To Do', done: false }} />).container;
    expect(todo.querySelector('[data-card-status-done]')).toBeNull();
    expect(todo.querySelector('[aria-hidden]')!.className).toContain('bg-slate-400');
  });

  it('is not drawn off a card, or on a card no column holds (deleted, All Cards, an older push)', () => {
    const element = thread({ card: null, tabId: 'tab-1', elementId: 'el-1' });
    const gone = thread({ elementId: 'th-2', card: { ...card, column: null } });
    const older = thread({ elementId: 'th-3', card: { ...card, column: undefined } });
    for (const f of factsOf(data([element, gone, older]))) expect(f.column).toBeNull();
    for (const column of [null, undefined, { name: '', done: false }]) {
      expect(render(<CardStatusChip column={column} />).container.innerHTML).toBe('');
    }
  });
});

describe("the sidebar's Inbox count", () => {
  it('counts My Actions and the threads that ask something of me, not those I replied in', () => {
    const d = data(
      [
        // On my plan, not answered by me: counted.
        thread({ elementId: 'a' }),
        // A mention: counted.
        thread({ elementId: 'b', onYourItem: false, mentionsYou: true, youCommented: true }),
        // I replied: listed, not counted.
        thread({ elementId: 'c', youCommented: true }),
        // Resolved: neither.
        thread({ elementId: 'd', resolved: true }),
      ],
      [action(), action({ actionId: 'x', assigneeId: 'user_bo', assignerId: 'user_me' })],
    );
    expect(inboxCount(d, 'user_me')).toBe(3);
    expect(inboxCount(null, 'user_me')).toBeUndefined();
  });

  // The owner's report (2026-11-09): "my inbox was 0 when I had lots of comment threads to address". The threads
  // were questions agents asked on their plan's cards with their token; they are pushed in `agentIds`, so
  // `youCommented` is false and each reads On your plan, counted until answered by hand.
  it('is not 0 while threads on my plan wait on me, an agent with my token having written them', () => {
    const asked = [1, 2, 3].map((n) => thread({ elementId: `q${n}`, youCommented: false }));
    expect(inboxCount(data(asked), 'user_me')).toBe(3);
    expect(threadReason(asked[0]!, 'user_me')).toEqual({ kind: 'yours', label: 'On your plan' });
  });

  it('reads a thread reached only through my agent as Your agent wrote, not counted', () => {
    const t = thread({ onYourItem: false, youCommented: false, mentionsYou: false });
    expect(threadReason(t, 'user_me')).toEqual({ kind: 'agent', label: 'Your agent wrote' });
    expect(inboxCount(data([t]), 'user_me')).toBe(0);
  });
});
