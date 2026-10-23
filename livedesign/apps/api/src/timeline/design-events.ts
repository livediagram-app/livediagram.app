// Design lifecycle + collaboration events (docs/specs/013-workspace/timeline.md §4.2, §4.3).
//
// One exported function per event, so a route's emit is a single line
// and the copy for a given event lives in exactly one place. The
// title/description split is load-bearing: titles are Title Case
// categories that never carry user content, which is what lets four
// bubbles collapse into one honest stacked headline (docs/specs/013-workspace/timeline.md §2.1).

import { HOME_OPENED_EVENT_TYPE, TIMELINE_COMMENT_MAX } from '@livedesign/api-schema';
import type { TimelineScopeRef } from '@livedesign/api-schema';
import { dedupeKeyForDay, dedupeKeyOnce, deleteCommentEvents } from '../db/timeline';
import type { DesignDTO, Env } from '../types';
import { audienceForDesign, mergeScopes, userScope } from './audience';
import { record, truncate } from './record';

type DesignRef = Pick<DesignDTO, 'id' | 'name' | 'ownerId' | 'teamId'>;

// Shared snapshot so every design bubble can render its name and link
// without the reader fanning out into the designs table — and so a
// deleted design's tombstone still knows what it was called.
function designSnapshot(liveDoc: DesignRef): Record<string, unknown> {
  return { designId: liveDoc.id, designName: liveDoc.name };
}

/** Whether a making counts as a use of the design for its maker
 *  (docs/specs/013-workspace/explorer-home.md "Making a design"). */
export type Making = { markUsed: boolean };

// A making that counts carries `markUsed: true`, which Explorer Home's Jump back in reads
// (MARKED_MAKING, db/home.ts); one that does not carries nothing, as every making before the mark.
function makingSnapshot(making: Making): Record<string, unknown> {
  return making.markUsed ? { markUsed: true } : {};
}

export async function recordDesignCreated(
  env: Env,
  liveDoc: DesignRef,
  actorId: string,
  making: Making,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: liveDoc.id,
      eventType: 'design_created',
      title: 'Design Created',
      description: liveDoc.name,
      snapshot: { ...designSnapshot(liveDoc), ...makingSnapshot(making) },
    },
    await audienceForDesign(env, liveDoc),
  );
}

export async function recordDesignDuplicated(
  env: Env,
  copy: DesignRef,
  sourceName: string,
  actorId: string,
  making: Making,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: copy.id,
      eventType: 'design_duplicated',
      title: 'Design Duplicated',
      description: `${sourceName} → ${copy.name}`,
      snapshot: { ...designSnapshot(copy), sourceName, ...makingSnapshot(making) },
    },
    await audienceForDesign(env, copy),
  );
}

// There is deliberately no recordDesignDeleted. A deleted design is
// swept from the feed (docs/specs/013-workspace/timeline.md §3.5) and nothing is written in its
// place: from the Timeline's point of view it never existed.

export async function recordDesignMoved(
  env: Env,
  liveDoc: DesignRef,
  destination: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: liveDoc.id,
      eventType: 'design_moved',
      dedupeKey: dedupeKeyOnce(),
      title: 'Moved to a Folder',
      description: `${liveDoc.name} → ${destination}`,
      snapshot: { ...designSnapshot(liveDoc), destination },
    },
    await audienceForDesign(env, liveDoc),
  );
}

// A design was published INTO a team library. The out direction is
// recordTeamDesignRemoved below — it needs a different title, a different
// audience and an owner change, so it could not share this one.
export async function recordTeamDesignAdded(
  env: Env,
  liveDoc: DesignRef,
  teamName: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: liveDoc.id,
      eventType: 'team_design_added',
      dedupeKey: dedupeKeyOnce(),
      title: 'Shared with a Team',
      description: `${liveDoc.name} → ${teamName}`,
      snapshot: { ...designSnapshot(liveDoc), teamName },
    },
    await audienceForDesign(env, liveDoc),
  );
}

// A design was pulled back OUT of a team library into personal files
// (docs/specs/013-workspace/team-shared-designs.md + docs/specs/013-workspace/timeline.md). Not the same event as `design_moved`, which is
// personal tidying: the team loses the design outright, and when the mover
// isn't the owner they take ownership of it too — so the previous owner loses
// it as well.
//
// The audience is passed IN rather than resolved here, because by the time this
// fires the design is already personal and `audienceForDesign` would return
// only its new owner. The caller resolves the OLD team's audience before the
// move, exactly as the delete path does for the same reason.
export async function recordTeamDesignRemoved(
  env: Env,
  liveDoc: DesignRef,
  teamName: string,
  actorId: string,
  audience: TimelineScopeRef[],
  newOwnerName: string | null,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: liveDoc.id,
      eventType: 'team_design_removed',
      dedupeKey: dedupeKeyOnce(),
      title: 'Removed from a Team',
      description: `${liveDoc.name} → ${teamName}`,
      snapshot: {
        ...designSnapshot(liveDoc),
        teamName,
        ...(newOwnerName ? { newOwnerName } : {}),
      },
    },
    audience,
  );
}

// The coalesced editing event (docs/specs/013-workspace/timeline.md §4.2).
//
// Emitted from the tab-save path. The dedupe key collapses a
// whole day of saves by one person on one design into a single row
// whose occurred_at walks forward — otherwise the highest-volume write
// in the product would bury every other event kind, stacking or not.
export async function recordDocumentEdited(
  env: Env,
  liveDoc: DesignRef,
  actorId: string,
): Promise<void> {
  const now = Date.now();
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: liveDoc.id,
      eventType: 'design_edited',
      dedupeKey: dedupeKeyForDay(actorId, now),
      title: 'Design Updated',
      // Actor-relative copy is resolved by the renderer ("You worked
      // on X" vs "Priya edited X"), so the stored description stays
      // viewer-agnostic and one row serves the whole audience.
      description: liveDoc.name,
      occurredAt: now,
      snapshot: designSnapshot(liveDoc),
    },
    await audienceForDesign(env, liveDoc),
  );
}

export async function recordCommentAdded(
  env: Env,
  liveDoc: DesignRef,
  // `reply`: not the first comment of its thread (Explorer Home says "replied").
  comment: { id: string; text: string; authorName: string; authorColor?: string; reply: boolean },
  // Null for a peer's comment whose author is not yet known (claimedComments, tab-diff.ts).
  actorId: string | null,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      // The comment id, not the design id: two comments on one
      // design are two events, and the UNIQUE key is what stops a
      // retried save re-emitting the same one.
      sourceId: comment.id,
      eventType: 'comment_added',
      title: 'Comment Added',
      description: truncate(comment.text, TIMELINE_COMMENT_MAX),
      snapshot: {
        ...designSnapshot(liveDoc),
        authorName: comment.authorName,
        authorColor: comment.authorColor ?? null,
        reply: comment.reply,
      },
    },
    await audienceForDesign(env, liveDoc),
  );
}

export async function recordCommentResolved(
  env: Env,
  liveDoc: DesignRef,
  threadKey: string,
  // The thread's opening comment, so the feed can say what was resolved.
  text: string | null,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: threadKey,
      eventType: 'comment_resolved',
      title: 'Comment Resolved',
      description: text ? truncate(text, TIMELINE_COMMENT_MAX) : liveDoc.name,
      snapshot: designSnapshot(liveDoc),
    },
    await audienceForDesign(env, liveDoc),
  );
}

// Comments were deleted (docs/specs/013-workspace/timeline.md §4.3): their words leave the feed
// with them. `threadKey` is set for a comment that opened its thread, whose text the thread's
// `comment_resolved` event carries. Swallows its failure the way `record` does: the delete it
// follows has already happened.
export async function retractComments(
  env: Env,
  designId: string,
  removed: readonly { id: string; threadKey: string | null }[],
): Promise<void> {
  if (removed.length === 0) return;
  try {
    await deleteCommentEvents(
      env,
      designId,
      removed.map((c) => c.id),
      removed.flatMap((c) => (c.threadKey ? [c.threadKey] : [])),
    );
  } catch (err) {
    console.error('timeline comment retract failed', designId, err);
  }
}

// An action was assigned on an element (docs/specs/012-collaboration/assigned-actions.md). Reaches the assignee
// as well as everyone who can see the design — usually overlapping
// sets, which is what mergeScopes is for. When the assignee is an
// invited-but-not-joined member they have no owner id yet, so they get
// the event once they join and the design audience covers them.
export async function recordActionAssigned(
  env: Env,
  liveDoc: DesignRef,
  action: { id: string; name: string; assigneeId: string | null; assigneeName: string | null },
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: action.id,
      eventType: 'action_assigned',
      title: 'Action Assigned',
      description: action.assigneeName ? `${action.name} → ${action.assigneeName}` : action.name,
      snapshot: {
        ...designSnapshot(liveDoc),
        actionName: action.name,
        assigneeName: action.assigneeName,
        // Who it went to, so Explorer Home can say "assigned you an action" to them alone.
        assigneeId: action.assigneeId,
      },
    },
    mergeScopes(
      await audienceForDesign(env, liveDoc),
      action.assigneeId ? [userScope(action.assigneeId)] : [],
    ),
  );
}

export async function recordActionCompleted(
  env: Env,
  liveDoc: DesignRef,
  action: { id: string; name: string },
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: action.id,
      eventType: 'action_completed',
      title: 'Action Completed',
      description: action.name,
      snapshot: { ...designSnapshot(liveDoc), actionName: action.name },
    },
    await audienceForDesign(env, liveDoc),
  );
}

// Share-link events are owner-only: who a design is shared with is the
// owner's business, and a team member seeing "a link was created" adds
// nothing they can act on.
export async function recordShareLinkCreated(
  env: Env,
  liveDoc: DesignRef,
  role: string,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: `${liveDoc.id}:${role}`,
      eventType: 'share_link_created',
      dedupeKey: dedupeKeyOnce(),
      title: 'Share Link Created',
      description: liveDoc.name,
      snapshot: { ...designSnapshot(liveDoc), role },
    },
    [userScope(liveDoc.ownerId)],
  );
}

// Future-dated: occurredAt is the expiry, not now, so this lands in the
// feed's forward band above Today (docs/specs/013-workspace/timeline.md §4.5). That band is the
// only reason a user opens the Timeline BEFORE something breaks.
export async function recordShareLinkExpiring(
  env: Env,
  liveDoc: DesignRef,
  expiresAt: number,
): Promise<void> {
  await record(
    env,
    {
      actorId: null,
      sourceType: 'design',
      sourceId: liveDoc.id,
      eventType: 'share_link_expiring',
      title: 'Share Link Expiring',
      description: liveDoc.name,
      occurredAt: expiresAt,
      snapshot: { ...designSnapshot(liveDoc), expiresAt },
    },
    [userScope(liveDoc.ownerId)],
  );
}

// Offline Mode conversions (docs/specs/006-design/offline-mode.md). Owner-only: an offline design
// exists in exactly one browser, so nobody else has a stake in it.
export async function recordDesignOffline(
  env: Env,
  liveDoc: DesignRef,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: liveDoc.id,
      eventType: 'design_offline',
      dedupeKey: dedupeKeyOnce(),
      title: 'Taken Offline',
      description: liveDoc.name,
      // No designId: the server copy is gone, so the row must not link
      // anywhere. Same structural trick as the delete tombstone.
      snapshot: { designName: liveDoc.name },
    },
    [userScope(actorId)],
  );
}

export async function recordDesignSynced(
  env: Env,
  liveDoc: DesignRef,
  actorId: string,
): Promise<void> {
  await record(
    env,
    {
      actorId,
      sourceType: 'design',
      sourceId: liveDoc.id,
      eventType: 'design_synced',
      dedupeKey: dedupeKeyOnce(),
      title: 'Synced to the Cloud',
      description: liveDoc.name,
      snapshot: designSnapshot(liveDoc),
    },
    await audienceForDesign(env, liveDoc),
  );
}

// A person opened a design (docs/specs/013-workspace/explorer-home.md "Opens"). Private: scoped
// to the person alone, never the design's history or a team's feed, and left out of the
// Timeline feed (docs/specs/013-workspace/timeline.md §4.2); Home's Timeline column reads it by
// actor. Called once per person per design per UTC day, by recordDesignOpen, which owns the
// dedupe; the day key makes a retry land on the same row.
export async function recordDesignOpened(
  env: Env,
  liveDoc: DesignRef,
  personId: string,
  at: number,
): Promise<void> {
  await record(
    env,
    {
      actorId: personId,
      sourceType: 'design',
      sourceId: liveDoc.id,
      eventType: HOME_OPENED_EVENT_TYPE,
      dedupeKey: dedupeKeyForDay(personId, at),
      title: 'Design Opened',
      description: liveDoc.name,
      occurredAt: at,
      snapshot: designSnapshot(liveDoc),
    },
    [userScope(personId)],
  );
}

// Somebody followed a share link and opened the design.
//
// Owner-only, and coalesced per visitor per day: this is the one event a
// stranger can trigger at will, so an uncoalesced emit would let anyone
// with a link flood an owner's feed by refreshing. The dedupe key makes
// a hundred opens one row.
export async function recordVisitorOpened(
  env: Env,
  liveDoc: DesignRef,
  visitorId: string,
  visitorName: string | null,
): Promise<void> {
  const now = Date.now();
  await record(
    env,
    {
      // The visitor is the actor, but the row is scoped to the owner —
      // so it survives the "Other people" filter, which is exactly the
      // audience for "somebody opened your design".
      actorId: visitorId,
      sourceType: 'design',
      sourceId: liveDoc.id,
      eventType: 'design_opened_by_visitor',
      dedupeKey: dedupeKeyForDay(visitorId, now),
      title: 'Opened by a Visitor',
      description: liveDoc.name,
      occurredAt: now,
      snapshot: { ...designSnapshot(liveDoc), visitorName },
    },
    [userScope(liveDoc.ownerId)],
  );
}

export async function recordVisitorCopied(
  env: Env,
  liveDoc: DesignRef,
  visitorId: string,
  visitorName: string | null,
): Promise<void> {
  await record(
    env,
    {
      actorId: visitorId,
      sourceType: 'design',
      sourceId: `${liveDoc.id}:${visitorId}:copied`,
      eventType: 'design_copied_by_visitor',
      title: 'Copied by a Visitor',
      description: liveDoc.name,
      snapshot: { ...designSnapshot(liveDoc), visitorName },
    },
    [userScope(liveDoc.ownerId)],
  );
}
