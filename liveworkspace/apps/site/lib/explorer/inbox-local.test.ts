// @vitest-environment jsdom
// The Inbox on an app's own address (inbox.tsx `localInboxHost`): the app's This Browser rows, from the snapshot the
// app keeps in this origin's localStorage, only for the person it names, heard as the app rewrites it. On
// liveworkspace.app (no app) there are none: the snapshot is on the app's origin.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InboxAction } from '@liveworkspace/index-client';
import { writeInboxSnapshot } from '@liveworkspace/explorer/this-browser';
import { inboxHost, localInboxHost } from './inbox';
import { itemHref } from './host';

afterEach(() => localStorage.clear());

const card: InboxAction = {
  app: 'liveplanner',
  itemId: 'local-plan',
  itemTitle: 'Launch',
  itemTeamId: null,
  tabId: '~cards',
  tabName: '',
  elementId: 'card-1',
  actionId: 'card:card-1',
  elementLabel: 'Book the venue',
  name: 'Book the venue',
  description: '',
  status: 'open',
  assigneeId: 'user_me',
  assigneeName: null,
  assignerId: 'user_me',
  assignerName: null,
  teamId: null,
  card: { key: 7, type: 'task', typeLabel: 'Task', title: 'Book the venue', board: null },
  createdAt: 1,
  updatedAt: 1,
};

describe("the Inbox's This Browser rows on an app's address", () => {
  it("lists the app's snapshot to the person it names, and to no one else", async () => {
    writeInboxSnapshot('liveplanner', ['user_me', 'guest_1'], { actions: [card], threads: [] });
    const mine = localInboxHost(inboxHost, 'liveplanner', 'user_me');
    expect((await mine.localRows!()).actions.map((a) => a.elementId)).toEqual(['card-1']);
    // Kept the base host's extras.
    expect(mine.actionsHelpHref).toBe(inboxHost.actionsHelpHref);
    const theirs = localInboxHost(inboxHost, 'liveplanner', 'user_other');
    expect((await theirs.localRows!()).actions).toEqual([]);
  });

  it('hears the app rewrite it', () => {
    const host = localInboxHost(inboxHost, 'liveplanner', 'user_me');
    const heard = vi.fn();
    const stop = host.subscribeLocal!(heard);
    writeInboxSnapshot('liveplanner', ['user_me'], { actions: [card], threads: [] });
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });

  it('opens a row in the app on this origin, like any of its items', () => {
    const href = itemHref(
      { id: card.itemId, app: 'liveplanner', kind: 'plan', sharedVia: null },
      { tabId: null, elementId: null, cardId: card.elementId },
    );
    expect(href).toContain('/project/local-plan');
    expect(href).toContain('item=card-1');
  });

  it('adds nothing on liveworkspace.app', () => {
    expect(localInboxHost(inboxHost, null, 'user_me')).toBe(inboxHost);
  });
});
