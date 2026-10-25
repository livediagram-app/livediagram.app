import { describe, expect, it, vi } from 'vitest';
import { COLLAB_CARDS_TAB } from '@liveworkspace/index-client';
import type { OfflineActivity } from './offline/offline-activity';

vi.mock('./telemetry', () => ({ track: vi.fn() }));
const { localInboxRows, trackInbox } = await import('./explorer-inbox-host');
const { track } = await import('./telemetry');

const place = {
  projectId: 'p1',
  projectName: 'Offline plan',
  teamId: null,
  via: 'own' as const,
  shareCode: null,
};
const board = { tabId: 't2', tabName: 'Board', elementId: 'b1', title: 'Sprint' };
const latest = { text: 'Hi', authorName: 'Ada King', authorColor: '#123456', at: 9 };

const local: OfflineActivity = {
  actions: [
    {
      ...place,
      tabId: 't1',
      tabName: 'Roadmap',
      elementId: 'e1',
      elementLabel: 'Kick-off',
      id: 'a1',
      name: 'Book it',
      description: 'Soon',
      assignee: { userId: 'guest_old', name: 'Me' },
      assigner: { id: 'guest_old', name: 'Me' },
      createdAt: 1,
      updatedAt: 2,
      assignedToMe: true,
      createdByMe: true,
    },
  ],
  threads: [
    {
      ...place,
      tabId: 't1',
      tabName: 'Roadmap',
      elementId: 'e2',
      elementLabel: 'Budget',
      commentCount: 2,
      latest,
      firstAt: 1,
      youCommented: false,
      onYourProject: true,
      mentionsYou: true,
    },
  ],
  cards: [
    {
      ...place,
      board,
      id: 'c1',
      key: 4,
      type: 'task',
      title: 'Ship',
      status: 'todo',
      updatedAt: 5,
    },
  ],
  cardThreads: [
    {
      ...place,
      board: null,
      id: 'c2',
      key: 5,
      type: 'nope',
      title: 'Loose',
      commentCount: 1,
      latest,
      firstAt: 1,
      youCommented: true,
      onYourProject: true,
      mentionsYou: false,
    },
  ],
};

describe('the Inbox host', () => {
  it('turns This Browser rows into the index’s shape, the reader standing in for their old ids', () => {
    const rows = localInboxRows(local, 'user_me');
    expect(rows.actions[0]).toMatchObject({
      app: 'liveplanner',
      itemId: 'p1',
      itemTitle: 'Offline plan',
      tabName: 'Roadmap',
      assigneeId: 'user_me',
      assignerId: 'user_me',
      description: 'Soon',
      card: null,
    });
    expect(rows.actions[1]).toMatchObject({
      tabId: COLLAB_CARDS_TAB,
      elementId: 'c1',
      assigneeId: 'user_me',
      card: { key: 4, type: 'task', title: 'Ship', board },
    });
    expect(rows.threads[0]).toMatchObject({
      elementId: 'e2',
      latestAuthorColor: '#123456',
      mentionsYou: true,
      onYourItem: true,
      card: null,
    });
    // A custom type, whose name lives in its plan, reads as a plain card.
    expect(rows.threads[1]).toMatchObject({
      elementId: 'c2',
      card: { typeLabel: 'Card', board: null },
    });
  });

  it('reports each Inbox event as its own literal pair', () => {
    trackInbox('Opened');
    trackInbox('Selected', 'Card');
    trackInbox('Loaded', 'Retry');
    expect(vi.mocked(track).mock.calls).toEqual([
      ['Activity', 'Opened', undefined],
      ['Activity', 'Selected', 'Card'],
      ['Activity', 'Loaded', 'Retry'],
    ]);
  });
});
