'use client';

// What the shared Explorer's Inbox (@liveworkspace/explorer `InboxHost`) needs from livedesign beyond the index:
// the rows of designs in This Browser, which never reach the index (lib/offline/offline-activity.ts), the help
// article on actions, and telemetry. Designs hold no cards, so no card glyph. The editor's Explorer panel uses it.

import type { ActivityAction, ActivityThread } from '@livedesign/api-schema';
import type { InboxAction, InboxThread } from '@liveworkspace/index-client';
import type { InboxHost, InboxLocalRows, InboxTelemetry } from '@liveworkspace/explorer';
import { helpArticleHref } from './help-articles';
import { getGuestSelfId } from './local-identity';
import { inboxSnapshot } from './offline/inbox-snapshot';
import { readOfflineActivity, type OfflineActivity } from './offline/offline-activity';
import { track } from './telemetry';

// Each a literal pair, so the telemetry manifest's coverage test sees it (docs/specs/017-telemetry/telemetry.md).
export const trackInbox: InboxTelemetry = (action, type) => {
  switch (action) {
    case 'Opened':
      return track('Activity', 'Opened', type);
    case 'Selected':
      return track('Activity', 'Selected', type);
    case 'Loaded':
      return track('Activity', 'Loaded', type);
  }
};

const placeOf = (r: ActivityAction | ActivityThread) => ({
  app: 'livedesign' as const,
  itemId: r.designId,
  itemTitle: r.designName,
  itemTeamId: r.teamId,
  tabId: r.tabId,
  tabName: r.tabName,
  elementId: r.elementId,
  elementLabel: r.elementLabel,
  card: null,
});

// The offline read's rows in the index's shape. `me` stands in for the reader's ids, which the read already matched.
export function localInboxRows(local: OfflineActivity, me: string): InboxLocalRows {
  const action = (a: ActivityAction): InboxAction => ({
    ...placeOf(a),
    actionId: a.id,
    name: a.name,
    description: a.description,
    status: 'open',
    assigneeId: a.assignedToMe ? me : a.assignee.userId,
    assigneeName: a.assignee.name,
    assignerId: a.createdByMe ? me : a.assigner.id,
    assignerName: a.assigner.name,
    teamId: a.teamId,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  });
  const thread = (t: ActivityThread): InboxThread => ({
    ...placeOf(t),
    resolved: false,
    commentCount: t.commentCount,
    latestText: t.latest.text,
    latestAuthorName: t.latest.authorName,
    latestAuthorColor: t.latest.authorColor,
    mentionsYou: t.mentionsYou,
    youCommented: t.youCommented,
    onYourItem: t.onYourDesign,
    firstAt: t.firstAt,
    latestAt: t.latest.at,
  });
  return { actions: local.actions.map(action), threads: local.threads.map(thread) };
}

/** The Explorer's Inbox for this person: their This Browser designs' rows, help and telemetry. */
export function explorerInboxHost(ownerId: string | null): InboxHost {
  return {
    localRows: async () => {
      if (!ownerId) return { actions: [], threads: [] };
      const ids = [ownerId, getGuestSelfId()];
      const rows = localInboxRows(await readOfflineActivity(ids), ownerId);
      // The Explorer page on this address lists the same rows from the snapshot (lib/offline/inbox-snapshot.ts).
      inboxSnapshot.publish(ids, rows);
      return rows;
    },
    actionsHelpHref: helpArticleHref('assignedActions'),
    onTelemetry: trackInbox,
  };
}
