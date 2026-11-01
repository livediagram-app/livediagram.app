import { describe, expect, it, vi } from 'vitest';
import type { OfflineActivity } from './offline/offline-activity';

vi.mock('./telemetry', () => ({ track: vi.fn() }));
const { explorerInboxActions, localInboxRows, trackInbox } = await import('./explorer-inbox-host');
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

describe('the Inbox pane’s verbs in the editor’s panel', () => {
  const row = {
    kind: 'Thread' as const,
    app: 'livediagram' as const,
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
    expect(actions.offers({ ...row, app: 'liveplanner' })).toEqual([]);
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
