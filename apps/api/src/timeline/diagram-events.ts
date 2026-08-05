// Diagram lifecycle + collaboration events (spec/138 §4.2, §4.3).
//
// One exported function per event, so a route's emit is a single line
// and the copy for a given event lives in exactly one place. The
// title/description split is load-bearing: titles are Title Case
// categories that never carry user content, which is what lets four
// bubbles collapse into one honest stacked headline (spec/138 §2.1).

import { TIMELINE_COMMENT_MAX } from '@livediagram/api-schema';
import type { TimelineScopeRef } from '@livediagram/api-schema';
import { dedupeKeyForDay } from '../db/timeline';
import type { DiagramDTO, Env } from '../types';
import { audienceForDiagram, mergeScopes, userScope } from './audience';
import { record, truncate } from './record';

type DiagramRef = Pick<DiagramDTO, 'id' | 'name' | 'ownerId' | 'teamId'>;

// Shared snapshot so every diagram bubble can render its name and link
// without the reader fanning out into the diagrams table — and so a
// deleted diagram's tombstone still knows what it was called.
function diagramSnapshot(diagram: DiagramRef): Record<string, unknown> {
  return { diagramId: diagram.id, diagramName: diagram.name };
}

export async function recordDiagramCreated(
  env: Env,
  diagram: DiagramRef,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: diagram.id,
      eventType: 'diagram_created',
      title: 'Diagram Created',
      description: diagram.name,
      snapshot: diagramSnapshot(diagram),
    },
    await audienceForDiagram(env, diagram),
  );
}

export async function recordDiagramRenamed(
  env: Env,
  diagram: DiagramRef,
  previousName: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: diagram.id,
      eventType: 'diagram_renamed',
      title: 'Diagram Renamed',
      description: `${previousName} → ${diagram.name}`,
      snapshot: { ...diagramSnapshot(diagram), previousName },
    },
    await audienceForDiagram(env, diagram),
  );
}

export async function recordDiagramDuplicated(
  env: Env,
  copy: DiagramRef,
  sourceName: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: copy.id,
      eventType: 'diagram_duplicated',
      title: 'Diagram Duplicated',
      description: `${sourceName} → ${copy.name}`,
      snapshot: { ...diagramSnapshot(copy), sourceName },
    },
    await audienceForDiagram(env, copy),
  );
}

// The tombstone. Emitted AFTER markTimelineEventsDeletedBySource has
// cleared this diagram's history, so it survives the cascade and a
// deleted diagram collapses to exactly one row (spec/138 §3.5). The
// audience is resolved before the delete, since the team link is gone
// once the row is.
export async function recordDiagramDeleted(
  env: Env,
  diagram: DiagramRef,
  actorId: string,
  audience: TimelineScopeRef[],
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: diagram.id,
      eventType: 'diagram_deleted',
      title: 'Diagram Deleted',
      description: diagram.name,
      // No diagramId in the snapshot: the renderer must NOT link a
      // tombstone anywhere, and leaving the id out makes that
      // structural rather than a rule someone has to remember.
      snapshot: { diagramName: diagram.name },
    },
    audience,
  );
}

export async function recordDiagramMoved(
  env: Env,
  diagram: DiagramRef,
  destination: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: diagram.id,
      eventType: 'diagram_moved',
      title: 'Moved to a Folder',
      description: `${diagram.name} → ${destination}`,
      snapshot: { ...diagramSnapshot(diagram), destination },
    },
    await audienceForDiagram(env, diagram),
  );
}

// A diagram was published into (or pulled out of) a team library.
export async function recordTeamDiagramAdded(
  env: Env,
  diagram: DiagramRef,
  teamName: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: diagram.id,
      eventType: 'team_diagram_added',
      title: 'Shared with a Team',
      description: `${diagram.name} → ${teamName}`,
      snapshot: { ...diagramSnapshot(diagram), teamName },
    },
    await audienceForDiagram(env, diagram),
  );
}

// The coalesced editing event (spec/138 §4.2).
//
// Emitted from the tab-save path rather than from `change_log`: the log
// is tab-scoped and 90-day, and reading it back to derive a daily
// rollup would be a join on every save. The dedupe key collapses a
// whole day of saves by one person on one diagram into a single row
// whose occurred_at walks forward — otherwise the highest-volume write
// in the product would bury every other event kind, stacking or not.
export async function recordDiagramEdited(
  env: Env,
  diagram: DiagramRef,
  actorId: string,
): Promise<void> {
  const now = Date.now();
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: diagram.id,
      eventType: 'diagram_edited',
      dedupeKey: dedupeKeyForDay(actorId, now),
      title: 'Diagram Updated',
      // Actor-relative copy is resolved by the renderer ("You worked
      // on X" vs "Priya edited X"), so the stored description stays
      // viewer-agnostic and one row serves the whole audience.
      description: diagram.name,
      occurredAt: now,
      snapshot: diagramSnapshot(diagram),
    },
    await audienceForDiagram(env, diagram),
  );
}

export async function recordCommentAdded(
  env: Env,
  diagram: DiagramRef,
  comment: { id: string; text: string; authorName: string; authorColor?: string },
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      // The comment id, not the diagram id: two comments on one
      // diagram are two events, and the UNIQUE key is what stops a
      // retried save re-emitting the same one.
      sourceId: comment.id,
      eventType: 'comment_added',
      title: 'Comment Added',
      description: truncate(comment.text, TIMELINE_COMMENT_MAX),
      snapshot: {
        ...diagramSnapshot(diagram),
        authorName: comment.authorName,
        authorColor: comment.authorColor ?? null,
      },
    },
    await audienceForDiagram(env, diagram),
  );
}

export async function recordCommentResolved(
  env: Env,
  diagram: DiagramRef,
  threadKey: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: threadKey,
      eventType: 'comment_resolved',
      title: 'Comment Resolved',
      description: diagram.name,
      snapshot: diagramSnapshot(diagram),
    },
    await audienceForDiagram(env, diagram),
  );
}

// An action was assigned on an element (spec/68). Reaches the assignee
// as well as everyone who can see the diagram — usually overlapping
// sets, which is what mergeScopes is for. When the assignee is an
// invited-but-not-joined member they have no owner id yet, so they get
// the event once they join and the diagram audience covers them.
export async function recordActionAssigned(
  env: Env,
  diagram: DiagramRef,
  action: { id: string; name: string; assigneeId: string | null; assigneeName: string | null },
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: action.id,
      eventType: 'action_assigned',
      title: 'Action Assigned',
      description: action.assigneeName ? `${action.name} → ${action.assigneeName}` : action.name,
      snapshot: {
        ...diagramSnapshot(diagram),
        actionName: action.name,
        assigneeName: action.assigneeName,
      },
    },
    mergeScopes(
      await audienceForDiagram(env, diagram),
      action.assigneeId ? [userScope(action.assigneeId)] : [],
    ),
  );
}

export async function recordActionCompleted(
  env: Env,
  diagram: DiagramRef,
  action: { id: string; name: string },
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: action.id,
      eventType: 'action_completed',
      title: 'Action Completed',
      description: action.name,
      snapshot: { ...diagramSnapshot(diagram), actionName: action.name },
    },
    await audienceForDiagram(env, diagram),
  );
}

// Share-link events are owner-only: who a diagram is shared with is the
// owner's business, and a team member seeing "a link was created" adds
// nothing they can act on.
export async function recordShareLinkCreated(
  env: Env,
  diagram: DiagramRef,
  role: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: `${diagram.id}:${role}`,
      eventType: 'share_link_created',
      title: 'Share Link Created',
      description: diagram.name,
      snapshot: { ...diagramSnapshot(diagram), role },
    },
    [userScope(diagram.ownerId)],
  );
}

// Future-dated: occurredAt is the expiry, not now, so this lands in the
// feed's forward band above Today (spec/138 §4.5). That band is the
// only reason a user opens the Timeline BEFORE something breaks.
export async function recordShareLinkExpiring(
  env: Env,
  diagram: DiagramRef,
  expiresAt: number,
): Promise<void> {
  await record(
    env,
    {
      actorId: null,
      sourceType: 'diagram',
      sourceId: diagram.id,
      eventType: 'share_link_expiring',
      title: 'Share Link Expiring',
      description: diagram.name,
      occurredAt: expiresAt,
      snapshot: { ...diagramSnapshot(diagram), expiresAt },
    },
    [userScope(diagram.ownerId)],
  );
}

// Offline Mode conversions (spec/76). Owner-only: an offline diagram
// exists in exactly one browser, so nobody else has a stake in it.
export async function recordDiagramOffline(
  env: Env,
  diagram: DiagramRef,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: diagram.id,
      eventType: 'diagram_offline',
      title: 'Taken Offline',
      description: diagram.name,
      // No diagramId: the server copy is gone, so the row must not link
      // anywhere. Same structural trick as the delete tombstone.
      snapshot: { diagramName: diagram.name },
    },
    [userScope(actorId)],
  );
}

export async function recordDiagramSynced(
  env: Env,
  diagram: DiagramRef,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'diagram',
      sourceId: diagram.id,
      eventType: 'diagram_synced',
      title: 'Synced to the Cloud',
      description: diagram.name,
      snapshot: diagramSnapshot(diagram),
    },
    await audienceForDiagram(env, diagram),
  );
}

// Somebody followed a share link and opened the diagram.
//
// Owner-only, and coalesced per visitor per day: this is the one event a
// stranger can trigger at will, so an uncoalesced emit would let anyone
// with a link flood an owner's feed by refreshing. The dedupe key makes
// a hundred opens one row.
export async function recordVisitorOpened(
  env: Env,
  diagram: DiagramRef,
  visitorId: string,
  visitorName: string | null,
): Promise<void> {
  const now = Date.now();
  await record(
    env,
    {
      // The visitor is the actor, but the row is scoped to the owner —
      // so it survives the "Other people" filter, which is exactly the
      // audience for "somebody opened your diagram".
      actorId: visitorId,
      sourceType: 'diagram',
      sourceId: diagram.id,
      eventType: 'diagram_opened_by_visitor',
      dedupeKey: dedupeKeyForDay(visitorId, now),
      title: 'Opened by a Visitor',
      description: diagram.name,
      occurredAt: now,
      snapshot: { ...diagramSnapshot(diagram), visitorName },
    },
    [userScope(diagram.ownerId)],
  );
}

export async function recordVisitorCopied(
  env: Env,
  diagram: DiagramRef,
  visitorId: string,
  visitorName: string | null,
): Promise<void> {
  await record(
    env,
    {
      actorId: visitorId,
      sourceType: 'diagram',
      sourceId: `${diagram.id}:${visitorId}:copied`,
      eventType: 'diagram_copied_by_visitor',
      title: 'Copied by a Visitor',
      description: diagram.name,
      snapshot: { ...diagramSnapshot(diagram), visitorName },
    },
    [userScope(diagram.ownerId)],
  );
}
