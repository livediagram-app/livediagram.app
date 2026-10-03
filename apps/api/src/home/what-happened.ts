// What happened (docs/specs/013-workspace/explorer-home.md; blueprint "Verbs", "Grouping"):
// other people's actions on documents the reader can open, one group per document per local day.
// Pure: the read hands in rows newest first, already scoped and filtered to other people.

import {
  HOME_VERBS,
  type HomeAction,
  type HomeDocument,
  type HomeGroup,
  type HomePerson,
  type HomeVerb,
} from '@livediagram/api-schema';
import { localDay } from './local-day';

/** One event of another person, as the read returns it. */
export type WhatHappenedRow = {
  eventId: string;
  eventType: string;
  actorId: string;
  occurredAt: number;
  description: string | null;
  snapshot: Record<string, unknown>;
  document: HomeDocument;
  actor: Omit<HomePerson, 'id'>;
};

/** The event types What happened reads, the closed set the spec lists. */
export const WHAT_HAPPENED_EVENT_TYPES = [
  'comment_added',
  'comment_resolved',
  'document_edited',
  'action_assigned',
  'action_completed',
  'team_document_added',
] as const;

function text(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  return typeof value === 'string' ? value : null;
}

/** The verb and detail of one event, or null for an event outside the closed set. `me` is the
 *  reader's id and every alias, so an action assigned to their guest-era self is still theirs. */
export function verbOf(
  eventType: string,
  snapshot: Record<string, unknown>,
  description: string | null,
  me: ReadonlySet<string>,
): { verb: HomeVerb; detail: string | null } | null {
  switch (eventType) {
    case 'comment_added':
      return { verb: snapshot.reply === true ? 'replied' : 'commented', detail: description };
    case 'comment_resolved':
      return { verb: 'resolved', detail: description };
    case 'document_edited':
      return { verb: 'edited', detail: null };
    case 'action_assigned': {
      const assignee = text(snapshot, 'assigneeId');
      const verb = assignee !== null && me.has(assignee) ? 'assigned_you' : 'assigned';
      return { verb, detail: text(snapshot, 'actionName') };
    }
    case 'action_completed':
      return { verb: 'completed', detail: text(snapshot, 'actionName') };
    case 'team_document_added':
      return { verb: 'shared', detail: text(snapshot, 'teamName') };
    default:
      return null;
  }
}

const VERB_ORDER = new Map<HomeVerb, number>(HOME_VERBS.map((verb, i) => [verb, i]));

/** Group rows (newest first) per document per day in `timeZone`; groups newest first. */
export function groupWhatHappened(
  rows: readonly WhatHappenedRow[],
  timeZone: string,
  me: ReadonlySet<string>,
): HomeGroup[] {
  const groups = new Map<string, { group: HomeGroup; people: Map<string, HomePerson> }>();
  for (const row of rows) {
    const mapped = verbOf(row.eventType, row.snapshot, row.description, me);
    if (!mapped) continue;
    const day = localDay(row.occurredAt, timeZone);
    const id = `${row.document.documentId}:${day}`;
    let entry = groups.get(id);
    if (!entry) {
      entry = {
        group: {
          ...row.document,
          id,
          day,
          summary: false,
          people: [],
          verbs: [],
          total: 0,
          latestAt: row.occurredAt,
          actions: [],
        },
        people: new Map(),
      };
      groups.set(id, entry);
    }
    const action: HomeAction = {
      id: row.eventId,
      verb: mapped.verb,
      personId: row.actorId,
      occurredAt: row.occurredAt,
      detail: mapped.detail,
    };
    entry.group.actions.push(action);
    if (!entry.people.has(row.actorId))
      entry.people.set(row.actorId, { id: row.actorId, ...row.actor });
  }
  return [...groups.values()]
    .map(({ group, people }) => finish(group, [...people.values()]))
    .sort((a, b) => b.latestAt - a.latestAt);
}

function finish(group: HomeGroup, people: HomePerson[]): HomeGroup {
  const counts = new Map<HomeVerb, number>();
  for (const action of group.actions) counts.set(action.verb, (counts.get(action.verb) ?? 0) + 1);
  return {
    ...group,
    people,
    summary: people.length > 1,
    verbs: [...counts]
      .sort(([a], [b]) => VERB_ORDER.get(a)! - VERB_ORDER.get(b)!)
      .map(([verb, count]) => ({ verb, count })),
    total: group.actions.length,
    latestAt: group.actions[0]!.occurredAt,
  };
}
