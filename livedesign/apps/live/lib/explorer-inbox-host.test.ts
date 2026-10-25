import { describe, expect, it, vi } from 'vitest';
import type { OfflineActivity } from './offline/offline-activity';

vi.mock('./telemetry', () => ({ track: vi.fn() }));
const { explorerInboxActions, localInboxRows, trackInbox } = await import('./explorer-inbox-host');
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

describe('the Inbox pane’s verbs in the editor’s panel', () => {
  const row = {
    kind: 'Thread' as const,
    app: 'livedesign' as const,
    itemId: 'i1',
    tabId: 't1',
    elementId: 'e1',
    actionId: null,
    local: false,
  };

  it('replies to and resolves this app’s threads only, and marks done an action on the open tab only', () => {
    const markDone = vi.fn();
    const actions = explorerInboxActions('user_me', { itemId: 'i1', tabId: 't1', markDone });
    expect(actions.offers(row)).toEqual(['reply', 'resolve']);
    expect(actions.offers({ ...row, app: 'livedocuments' })).toEqual([]);
    expect(actions.offers({ ...row, local: true })).toEqual([]);
    const action = { ...row, kind: 'Action' as const, actionId: 'a1' };
    expect(actions.offers(action)).toEqual(['done']);
    expect(actions.offers({ ...action, tabId: 't2' })).toEqual([]);
    void actions.done!(action);
    expect(markDone).toHaveBeenCalledWith('e1', 'a1');
  });

  it('offers nothing but Open with no account and nothing open', () => {
    const actions = explorerInboxActions(null, null);
    expect(actions.offers(row)).toEqual([]);
    expect(actions.offers({ ...row, kind: 'Action', actionId: 'a1' })).toEqual([]);
  });

  it('reports the filter bar and the pane’s verbs as their own pairs', () => {
    vi.mocked(track).mockClear();
    trackInbox('Changed', 'Comments');
    trackInbox('Added', 'Reply');
    trackInbox('Resolved', 'Thread');
    expect(vi.mocked(track).mock.calls).toEqual([
      ['Activity', 'Changed', 'Comments'],
      ['Activity', 'Added', 'Reply'],
      ['Activity', 'Resolved', 'Thread'],
    ]);
  });
});
