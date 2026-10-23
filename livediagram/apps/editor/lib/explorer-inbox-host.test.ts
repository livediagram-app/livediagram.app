import { describe, expect, it, vi } from 'vitest';
import type { OfflineActivity } from './offline/offline-activity';

vi.mock('./telemetry', () => ({ track: vi.fn() }));
const { localInboxRows, trackInbox } = await import('./explorer-inbox-host');
const { track } = await import('./telemetry');

const place = {
  documentId: 'p1',
  documentName: 'Offline canvas',
  teamId: null,
  via: 'own' as const,
  shareCode: null,
};
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
      onYourDocument: true,
      mentionsYou: true,
    },
  ],
};

describe('the Inbox host', () => {
  it('turns This Browser rows into the index’s shape, the reader standing in for their old ids', () => {
    const rows = localInboxRows(local, 'user_me');
    expect(rows.actions[0]).toMatchObject({
      app: 'livediagram',
      itemId: 'p1',
      itemTitle: 'Offline canvas',
      tabName: 'Roadmap',
      assigneeId: 'user_me',
      assignerId: 'user_me',
      description: 'Soon',
      card: null,
    });
    expect(rows.threads[0]).toMatchObject({
      elementId: 'e2',
      latestAuthorColor: '#123456',
      mentionsYou: true,
      onYourItem: true,
      card: null,
    });
  });

  it('reports each Inbox event as its own literal pair', () => {
    trackInbox('Opened');
    trackInbox('Selected', 'Thread');
    trackInbox('Loaded', 'Retry');
    expect(vi.mocked(track).mock.calls).toEqual([
      ['Activity', 'Opened', undefined],
      ['Activity', 'Selected', 'Thread'],
      ['Activity', 'Loaded', 'Retry'],
    ]);
  });
});
