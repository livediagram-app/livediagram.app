import { describe, expect, it, vi } from 'vitest';
import type { OfflineActivity } from './offline/offline-activity';

vi.mock('./telemetry', () => ({ track: vi.fn() }));
const { localInboxRows, trackInbox } = await import('./explorer-inbox-host');
const { track } = await import('./telemetry');

// A This Browser design's open actions and threads, in the index's Inbox shape (docs/specs/013-workspace/inbox.md).

const place = {
  designId: 'd1',
  designName: 'Offline design',
  teamId: null,
  via: 'own' as const,
  shareCode: null,
  tabId: 't1',
  tabName: 'Logo',
};

const local: OfflineActivity = {
  actions: [
    {
      ...place,
      elementId: 'e1',
      elementLabel: 'Wordmark',
      id: 'a1',
      name: 'Kern it',
      description: 'Soon',
      assignee: { userId: 'guest_old', name: 'Me' },
      assigner: { id: 'user_ada', name: 'Ada' },
      createdAt: 1,
      updatedAt: 2,
      assignedToMe: true,
      createdByMe: false,
    },
  ],
  threads: [
    {
      ...place,
      elementId: 'e2',
      elementLabel: 'Mark',
      commentCount: 2,
      latest: { text: 'Hi', authorName: 'Ada King', authorColor: '#123456', at: 9 },
      firstAt: 1,
      youCommented: false,
      onYourDesign: true,
      mentionsYou: true,
    },
  ],
};

describe('localInboxRows', () => {
  it('names the reader as themselves and keeps who else is involved', () => {
    const rows = localInboxRows(local, 'me');
    expect(rows.actions[0]).toMatchObject({
      app: 'livedesign',
      itemId: 'd1',
      itemTitle: 'Offline design',
      actionId: 'a1',
      elementLabel: 'Wordmark',
      assigneeId: 'me',
      assignerId: 'user_ada',
      status: 'open',
      card: null,
    });
    expect(rows.threads[0]).toMatchObject({
      itemId: 'd1',
      elementId: 'e2',
      latestText: 'Hi',
      latestAt: 9,
      onYourItem: true,
      mentionsYou: true,
      card: null,
    });
  });
});

it('reports the Inbox as Activity', () => {
  trackInbox('Opened', 'Inbox');
  expect(track).toHaveBeenCalledWith('Activity', 'Opened', 'Inbox');
});
