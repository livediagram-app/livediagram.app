'use client';

// What the shared Explorer's Inbox (@liveworkspace/explorer `InboxHost`) needs from liveplanner beyond the index:
// the rows of plans in This Browser, which never reach the index (lib/offline/offline-activity.ts), a Plan card
// type's glyph, the help article on actions, and telemetry. The Explorer page and the editor's panel both use it.

import type {
  ActivityAction,
  ActivityCard,
  ActivityCardThread,
  ActivityThread,
} from '@liveplanner/api-schema';
import { ITEM_TYPES } from '@liveplanner/items';
import {
  COLLAB_CARDS_TAB,
  type CollabCard,
  type InboxAction,
  type InboxThread,
} from '@liveworkspace/index-client';
import type { InboxHost, InboxLocalRows, InboxTelemetry } from '@liveworkspace/explorer';
import { PlanTypeGlyph } from '@/components/plan/plan-type-glyph';
import { helpArticleHref } from './help-articles';
import { getGuestSelfId } from './local-identity';
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

const typeLabel = (type: string) => ITEM_TYPES.find((t) => t.id === type)?.label ?? 'Card';

type Place = Pick<ActivityCard, 'projectId' | 'projectName' | 'teamId'>;

const itemOf = (p: Place) => ({
  app: 'liveplanner' as const,
  itemId: p.projectId,
  itemTitle: p.projectName,
  itemTeamId: p.teamId,
});

function cardOf(c: Pick<ActivityCard, 'key' | 'type' | 'title' | 'board'>): CollabCard {
  return { key: c.key, type: c.type, typeLabel: typeLabel(c.type), title: c.title, board: c.board };
}

// The offline read's rows in the index's shape. `me` stands in for the reader's ids, which the read already matched.
export function localInboxRows(local: OfflineActivity, me: string): InboxLocalRows {
  const action = (a: ActivityAction): InboxAction => ({
    ...itemOf(a),
    tabId: a.tabId,
    tabName: a.tabName,
    elementId: a.elementId,
    actionId: a.id,
    elementLabel: a.elementLabel,
    name: a.name,
    description: a.description,
    status: 'open',
    assigneeId: a.assignedToMe ? me : a.assignee.userId,
    assigneeName: a.assignee.name,
    assignerId: a.createdByMe ? me : a.assigner.id,
    assignerName: a.assigner.name,
    teamId: a.teamId,
    card: null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  });
  const card = (c: ActivityCard): InboxAction => ({
    ...itemOf(c),
    tabId: COLLAB_CARDS_TAB,
    tabName: '',
    elementId: c.id,
    actionId: `card:${c.id}`,
    elementLabel: c.title,
    name: c.title,
    description: '',
    status: 'open',
    assigneeId: me,
    assigneeName: null,
    assignerId: me,
    assignerName: null,
    teamId: c.teamId,
    card: cardOf(c),
    createdAt: c.updatedAt,
    updatedAt: c.updatedAt,
  });
  const facts = (t: ActivityThread | ActivityCardThread) => ({
    resolved: false,
    commentCount: t.commentCount,
    latestText: t.latest.text,
    latestAuthorName: t.latest.authorName,
    latestAuthorColor: t.latest.authorColor,
    mentionsYou: t.mentionsYou,
    youCommented: t.youCommented,
    onYourItem: t.onYourProject,
    firstAt: t.firstAt,
    latestAt: t.latest.at,
  });
  const thread = (t: ActivityThread): InboxThread => ({
    ...itemOf(t),
    tabId: t.tabId,
    tabName: t.tabName,
    elementId: t.elementId,
    elementLabel: t.elementLabel,
    card: null,
    ...facts(t),
  });
  const cardThread = (t: ActivityCardThread): InboxThread => ({
    ...itemOf(t),
    tabId: COLLAB_CARDS_TAB,
    tabName: '',
    elementId: t.id,
    elementLabel: t.title,
    card: cardOf(t),
    ...facts(t),
  });
  return {
    actions: [...local.actions.map(action), ...local.cards.map(card)],
    threads: [...local.threads.map(thread), ...local.cardThreads.map(cardThread)],
  };
}

/** The Explorer's Inbox for this person: their This Browser plans' rows, card glyphs, help and telemetry. */
export function explorerInboxHost(ownerId: string | null): InboxHost {
  return {
    localRows: async () => {
      if (!ownerId) return { actions: [], threads: [] };
      return localInboxRows(await readOfflineActivity([ownerId, getGuestSelfId()]), ownerId);
    },
    cardGlyph: (type) => (
      <PlanTypeGlyph glyph={ITEM_TYPES.find((t) => t.id === type)?.glyph} size={16} />
    ),
    actionsHelpHref: helpArticleHref('assignedActions'),
    onTelemetry: trackInbox,
  };
}
